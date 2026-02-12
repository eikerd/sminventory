import fs from "fs/promises";
import path from "path";
import { existsSync } from "fs";
import yaml from "js-yaml";
import { db } from "@/server/db";
import { workflowDependencies } from "@/server/db/schema";
import { CONFIG } from "@/lib/config";
import { eq } from "drizzle-orm";

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
async function findModelFile(
  modelType: string,
  modelName: string
): Promise<TreeNode | null> {
  const directories = await getModelDirectories(modelType);
  const baseDir = CONFIG.paths.models;

  // Try each configured directory
  for (const dir of directories) {
    const fullPath = path.join(baseDir, dir, modelName);

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
      const dirPath = path.join(baseDir, dir);
      if (existsSync(dirPath)) {
        const entries = await fs.readdir(dirPath, { withFileTypes: true });

        for (const entry of entries) {
          if (entry.name === modelName || entry.name.includes(modelName)) {
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
    } catch {
      // Continue to next directory
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

  // Debug logging
  console.log(`[DepTree] Workflow ${workflowId}:`, {
    groupKeys: Object.keys(groups),
    filesPerType: Object.entries(groups).map(([type, files]) => ({ type, count: files.length })),
    totalSize,
  });

  const allFiles = await Promise.all(
    Object.entries(groups).flatMap(([modelType, nodes]) =>
      nodes.map(async (node) => {
        const { emoji, displayName } = await getModelTypeInfo(modelType);
        return {
          modelType,
          displayName,
          name: node.name,
          size: node.size,
          sizeBytes: node.sizeBytes,
          path: node.path,
          exists: node.exists,
          emoji,
        };
      })
    )
  );

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
  };
}
