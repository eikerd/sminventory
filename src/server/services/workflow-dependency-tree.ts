import fs from "fs/promises";
import path from "path";
import { existsSync } from "fs";
import yaml from "js-yaml";
import { db } from "@/server/db";
import { workflowDependencies } from "@/server/db/schema";
import { CONFIG } from "@/lib/config";
import { eq } from "drizzle-orm";
import { estimateModelVRAM, estimateWorkflowVRAM, type VRAMEstimate, type ModelDependency } from "./vram-estimator";

// Typical sizes for models when not found on disk (used for VRAM estimation)
const TYPICAL_MODEL_SIZES_BYTES: Record<string, number> = {
  checkpoint: 6.5 * 1024 ** 3,      // ~6.5 GB (fp16 SDXL)
  diffusion_model: 9.0 * 1024 ** 3, // ~9 GB (fp8 14B)
  lora: 0.15 * 1024 ** 3,           // ~150 MB
  vae: 0.33 * 1024 ** 3,            // ~330 MB
  controlnet: 1.4 * 1024 ** 3,      // ~1.4 GB
  clip: 4.9 * 1024 ** 3,            // ~4.9 GB (T5-XXL fp8)
  clip_vision: 1.2 * 1024 ** 3,     // ~1.2 GB
  text_encoder: 4.9 * 1024 ** 3,    // ~4.9 GB (T5-XXL fp8)
  ipadapter: 1.6 * 1024 ** 3,       // ~1.6 GB
  upscaler: 0.07 * 1024 ** 3,       // ~70 MB
  embedding: 0.01 * 1024 ** 3,      // ~10 MB
};

/**
 * Get a fallback size estimate for a missing model based on its type and filename hints
 */
export function estimateMissingModelSize(modelType: string, modelName: string): number {
  let baseSize = TYPICAL_MODEL_SIZES_BYTES[modelType] || 2 * 1024 ** 3;

  // Refine estimate from filename hints
  const nameLower = modelName.toLowerCase();
  if (nameLower.includes("fp8")) baseSize *= 0.55;
  else if (nameLower.includes("fp16") || nameLower.includes("bf16")) baseSize *= 1.0;
  else if (nameLower.includes("fp32")) baseSize *= 2.0;
  else if (nameLower.includes("gguf")) baseSize *= 0.4;

  if (nameLower.includes("14b")) baseSize = Math.max(baseSize, 8 * 1024 ** 3);
  else if (nameLower.includes("xxl")) baseSize = Math.max(baseSize, 4.5 * 1024 ** 3);

  return Math.round(baseSize);
}

interface TreeNode {
  name: string;
  size: string;
  sizeBytes: number;
  path: string;
  exists: boolean;
}

interface DependencyGroup {
  [modelType: string]: TreeNode[];
}

interface ModelTypeConfig {
  directories: string[];
  displayName: string;
  emoji: string;
  description: string;
}

interface ModelStructureYaml {
  modelTypes: Record<string, ModelTypeConfig>;
  [key: string]: unknown;
}

let modelStructureCache: ModelStructureYaml | null = null;

/**
 * Load model structure configuration from YAML
 */
async function loadModelStructure(): Promise<ModelStructureYaml> {
  if (modelStructureCache) {
    return modelStructureCache;
  }

  try {
    const configPath = path.join(process.cwd(), "data", "model-structure.yaml");
    const content = await fs.readFile(configPath, "utf-8");
    modelStructureCache = yaml.load(content) as ModelStructureYaml;
    return modelStructureCache;
  } catch (error) {
    console.warn("Failed to load model-structure.yaml, using defaults", error);
    return { modelTypes: {} };
  }
}

/**
 * Convert bytes to human-readable size
 */
export function formatFileSize(bytes: number): string {
  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = bytes;

  for (const unit of units) {
    if (size < 1024) {
      return `${size.toFixed(1)}${unit}`;
    }
    size /= 1024;
  }

  return `${size.toFixed(1)}PB`;
}

/**
 * Parse size string back to bytes
 */
export function parseSizeToBytes(sizeStr: string): number {
  const multipliers: Record<string, number> = {
    TB: 1024 ** 4,
    GB: 1024 ** 3,
    MB: 1024 ** 2,
    KB: 1024,
    B: 1,
  };

  for (const [unit, mult] of Object.entries(multipliers)) {
    if (sizeStr.includes(unit)) {
      const num = parseFloat(sizeStr.replace(unit, "").trim());
      return num * mult;
    }
  }

  return 0;
}

/**
 * Get emoji and display name for model type from YAML config
 */
export async function getModelTypeInfo(modelType: string): Promise<{ emoji: string; displayName: string }> {
  const structure = await loadModelStructure();
  const config = structure.modelTypes[modelType];

  if (config) {
    return {
      emoji: config.emoji,
      displayName: config.displayName,
    };
  }

  return {
    emoji: "📦",
    displayName: modelType.charAt(0).toUpperCase() + modelType.slice(1),
  };
}

/**
 * Get directories for a model type from YAML config
 */
export async function getModelDirectories(modelType: string): Promise<string[]> {
  const structure = await loadModelStructure();
  const config = structure.modelTypes[modelType];

  if (config) {
    return config.directories;
  }

  // Fallback to CONFIG
  const dirs = CONFIG.modelTypeMap[modelType as keyof typeof CONFIG.modelTypeMap];
  return dirs || ["models"];
}

/**
 * Find a model file on disk
 */
export async function findModelFile(
  modelType: string,
  modelName: string
): Promise<TreeNode | null> {
  const directories = await getModelDirectories(modelType);
  const baseDir = CONFIG.paths.models;

  // Try each configured directory
  for (const dir of directories) {
    const fullPath = path.join(baseDir, dir, modelName);
    const dirPath = path.join(baseDir, dir);

    try {
      if (existsSync(fullPath)) {
        const stats = await fs.stat(fullPath);
        return {
          name: modelName,
          size: formatFileSize(stats.size),
          sizeBytes: stats.size,
          path: fullPath,
          exists: true,
        };
      }

      // Try to search in directory
      if (existsSync(dirPath)) {
        const entries = await fs.readdir(dirPath, { withFileTypes: true });

        for (const entry of entries) {
          // Exact match or match without extension to avoid false positives
          const nameWithoutExt = path.parse(modelName).name;
          if (entry.name === modelName || entry.name.startsWith(nameWithoutExt)) {
            const entryPath = path.join(dirPath, entry.name);
            const stats = await fs.stat(entryPath);
            return {
              name: entry.name,
              size: formatFileSize(stats.size),
              sizeBytes: stats.size,
              path: entryPath,
              exists: true,
            };
          }
        }
      }
    } catch (error) {
      console.error(`Error reading directory ${dirPath}:`, error);
    }
  }

  // File not found
  return {
    name: modelName,
    size: "?",
    sizeBytes: 0,
    path: path.join(baseDir, directories[0] || "models", modelName),
    exists: false,
  };
}

/**
 * Get workflow dependencies grouped by type
 */
export async function groupDependenciesByType(workflowId: string): Promise<DependencyGroup> {
  const deps = db
    .select()
    .from(workflowDependencies)
    .where(eq(workflowDependencies.workflowId, workflowId))
    .all();

  const grouped: DependencyGroup = {};

  for (const dep of deps) {
    if (!grouped[dep.modelType]) {
      grouped[dep.modelType] = [];
    }

    const file = await findModelFile(dep.modelType, dep.modelName);
    if (file) {
      grouped[dep.modelType].push(file);
    }
  }

  return grouped;
}

/**
 * Calculate total size from dependencies
 */
export function calculateTotalSize(groups: DependencyGroup): number {
  let total = 0;

  for (const nodes of Object.values(groups)) {
    for (const node of nodes) {
      total += node.sizeBytes;
    }
  }

  return total;
}

/**
 * Generate formatted tree output
 */
export async function generateWorkflowDependencyTree(workflowId: string): Promise<string> {
  const groups = await groupDependenciesByType(workflowId);
  const totalSize = calculateTotalSize(groups);

  let output = "\n" + "=".repeat(95) + "\n";
  output += "WORKFLOW DEPENDENCY TREE - REQUIRED FILES\n";
  output += "=".repeat(95) + "\n\n";

  output += "📦 Models/\n";
  output += "│\n";

  // Sort model types for consistent output
  const sortedTypes = Object.keys(groups).sort();
  let isLast = false;

  for (let i = 0; i < sortedTypes.length; i++) {
    const modelType = sortedTypes[i];
    const nodes = groups[modelType];
    isLast = i === sortedTypes.length - 1;

    const { emoji } = await getModelTypeInfo(modelType);
    const connector = isLast ? "└── " : "├── ";

    output += `${connector}${emoji} ${modelType}/\n`;

    for (let j = 0; j < nodes.length; j++) {
      const node = nodes[j];
      const isLastNode = j === nodes.length - 1;
      const prefix = isLast ? "    " : "│   ";
      const nodeConnector = isLastNode ? "└── " : "├── ";
      const status = node.exists ? "✅" : "❌";

      output += `${prefix}${nodeConnector}${status} ${node.name.padEnd(50)} ${node.size.padStart(8)}\n`;
    }

    if (!isLast) {
      output += "│\n";
    }
  }

  output += "\n" + "=".repeat(95) + "\n";
  output += "SUMMARY\n";
  output += "-".repeat(95) + "\n";

  let totalFiles = 0;
  let foundFiles = 0;

  for (const nodes of Object.values(groups)) {
    totalFiles += nodes.length;
    foundFiles += nodes.filter((n) => n.exists).length;
  }

  output += `Total Files:      ${totalFiles}\n`;
  output += `Found:            ${foundFiles}/${totalFiles}\n`;
  output += `Total Disk Size:  ${formatFileSize(totalSize)}\n`;
  output += `\nFile Breakdown:\n`;

  for (const nodes of Object.values(groups)) {
    for (const node of nodes) {
      output += `  • ${node.name.padEnd(60)} ${node.size.padStart(8)}\n`;
    }
  }

  output += "\n" + "=".repeat(95) + "\n";

  if (foundFiles === totalFiles) {
    output += "✅ STATUS: ALL DEPENDENCIES INSTALLED - WORKFLOW READY\n";
  } else {
    output += `⚠️  STATUS: ${totalFiles - foundFiles} DEPENDENCIES MISSING\n`;
  }

  output += "=".repeat(95) + "\n\n";

  return output;
}

/**
 * Get tree data as JSON (for API responses and views)
 */
export async function getWorkflowDependencyTreeData(workflowId: string) {
  const groups = await groupDependenciesByType(workflowId);
  const totalSize = calculateTotalSize(groups);

  if (process.env.NODE_ENV === "development") {
    console.log(`[DepTree] Workflow ${workflowId}:`, {
      groupKeys: Object.keys(groups),
      filesPerType: Object.entries(groups).map(([type, files]) => ({ type, count: files.length })),
      totalSize,
    });
  }

  const allFiles = await Promise.all(
    Object.entries(groups).flatMap(([modelType, nodes]) =>
      nodes.map(async (node) => {
        const { emoji, displayName } = await getModelTypeInfo(modelType);
        // Use actual size if found, otherwise estimate from type/name
        const effectiveSize = node.exists && node.sizeBytes > 0
          ? node.sizeBytes
          : estimateMissingModelSize(modelType, node.name);
        const precision = node.name.toLowerCase().includes("fp8") ? "fp8"
          : node.name.toLowerCase().includes("gguf") ? "gguf"
          : "unknown";
        const vramGB = estimateModelVRAM(modelType, precision, effectiveSize);
        return {
          modelType,
          displayName,
          name: node.name,
          size: node.exists ? node.size : `~${formatFileSize(effectiveSize)}`,
          sizeBytes: node.exists ? node.sizeBytes : effectiveSize,
          sizeEstimated: !node.exists,
          path: node.path,
          exists: node.exists,
          emoji,
          vramGB: Math.round(vramGB * 100) / 100,
        };
      })
    )
  );

  // Build VRAM estimate from ALL files (using estimates for missing ones)
  const modelDeps: ModelDependency[] = allFiles.map((f) => {
    const precision = f.name.toLowerCase().includes("fp8") ? "fp8"
      : f.name.toLowerCase().includes("gguf") ? "gguf"
      : "unknown";
    return {
      type: f.modelType,
      precision,
      sizeBytes: f.sizeBytes,
    };
  });
  const vramEstimate = estimateWorkflowVRAM(modelDeps);

  const summary = {
    totalFiles: allFiles.length,
    foundFiles: allFiles.filter((f) => f.exists).length,
    missingFiles: allFiles.filter((f) => !f.exists).length,
    totalSizeBytes: totalSize,
    totalSizeFormatted: formatFileSize(totalSize),
    ready: allFiles.every((f) => f.exists),
  };

  return {
    groups,
    allFiles,
    summary,
    vramEstimate,
  };
}
