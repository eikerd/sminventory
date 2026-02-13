import fs from "fs/promises";
import path from "path";
import { existsSync } from "fs";
import { v4 as uuidv4 } from "uuid";
import { db } from "@/server/db";
import { workflows, workflowDependencies, type NewWorkflow, type NewWorkflowDependency } from "@/server/db/schema";
import { CONFIG, WORKFLOW_STATUS, DEP_STATUS } from "@/lib/config";
import { eq } from "drizzle-orm";

interface ComfyUINode {
  id: number;
  type: string;
  widgets_values?: unknown[];
  inputs?: Record<string, unknown>;
}

interface ComfyUIWorkflow {
  nodes: ComfyUINode[];
  last_node_id?: number;
  last_link_id?: number;
  extra?: Record<string, unknown>;
}

interface ExtractedDependency {
  nodeId: number;
  nodeType: string;
  modelType: string;
  modelName: string;
}

// Node type to model mapping
const NODE_MODEL_MAP: Record<string, { modelType: string; field: string | string[]; widgetIndex?: number }> = {
  // Checkpoints
  CheckpointLoaderSimple: { modelType: "checkpoint", field: "ckpt_name", widgetIndex: 0 },
  CheckpointLoader: { modelType: "checkpoint", field: "ckpt_name", widgetIndex: 0 },
  UNETLoader: { modelType: "diffusion_model", field: "unet_name", widgetIndex: 0 },
  
  // LoRA
  LoraLoader: { modelType: "lora", field: "lora_name", widgetIndex: 0 },
  LoraLoaderModelOnly: { modelType: "lora", field: "lora_name", widgetIndex: 0 },
  
  // VAE
  VAELoader: { modelType: "vae", field: "vae_name", widgetIndex: 0 },
  
  // ControlNet
  ControlNetLoader: { modelType: "controlnet", field: "control_net_name", widgetIndex: 0 },
  DiffControlNetLoader: { modelType: "controlnet", field: "control_net_name", widgetIndex: 0 },
  ControlNetApply: { modelType: "controlnet", field: "control_net_name" },
  
  // CLIP
  CLIPLoader: { modelType: "clip", field: "clip_name", widgetIndex: 0 },
  DualCLIPLoader: { modelType: "clip", field: ["clip_name1", "clip_name2"], widgetIndex: 0 },
  TripleCLIPLoader: { modelType: "clip", field: ["clip_name1", "clip_name2", "clip_name3"], widgetIndex: 0 },
  CLIPVisionLoader: { modelType: "clip_vision", field: "clip_name", widgetIndex: 0 },
  
  // Upscale
  UpscaleModelLoader: { modelType: "upscaler", field: "model_name", widgetIndex: 0 },
  
  // IP Adapter
  IPAdapterModelLoader: { modelType: "ipadapter", field: "ipadapter_file", widgetIndex: 0 },
  
  // Wan / Video models
  DownloadAndLoadWanModel: { modelType: "diffusion_model", field: "model", widgetIndex: 0 },
  
  // Embeddings (typically used inline in prompts, but some nodes load them)
  EmbeddingLoader: { modelType: "embedding", field: "embedding_name", widgetIndex: 0 },
};

/**
 * Extract model dependencies from a ComfyUI workflow JSON
 */
function extractDependencies(workflow: ComfyUIWorkflow): ExtractedDependency[] {
  const dependencies: ExtractedDependency[] = [];

  for (const node of workflow.nodes) {
    const mapping = NODE_MODEL_MAP[node.type];
    if (!mapping) continue;

    const { modelType, field, widgetIndex } = mapping;
    const fields = Array.isArray(field) ? field : [field];

    for (let i = 0; i < fields.length; i++) {
      let modelName: string | null = null;

      // Try to get model name from widgets_values
      if (widgetIndex !== undefined && node.widgets_values) {
        const idx = widgetIndex + i;
        const value = node.widgets_values[idx];
        if (typeof value === "string" && value.trim()) {
          modelName = value;
        }
      }

      // Try to get from inputs if not in widgets
      if (!modelName && node.inputs) {
        const inputValue = node.inputs[fields[i]];
        if (typeof inputValue === "string" && inputValue.trim()) {
          modelName = inputValue;
        }
      }

      if (modelName) {
        dependencies.push({
          nodeId: node.id,
          nodeType: node.type,
          modelType,
          modelName,
        });
      }
    }
  }

  // Deduplicate by model name (same model can be used in multiple nodes)
  const seen = new Set<string>();
  return dependencies.filter((dep) => {
    const key = `${dep.modelType}:${dep.modelName}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Extract sampler settings from KSampler nodes
 */
function extractSamplerSettings(workflow: ComfyUIWorkflow): {
  steps?: number;
  cfg?: number;
  scheduler?: string;
  sampler?: string;
  denoise?: number;
} {
  const settings: ReturnType<typeof extractSamplerSettings> = {};

  // Look for KSampler or KSamplerAdvanced nodes
  const samplerNode = workflow.nodes.find(
    (n) => n.type === "KSampler" || n.type === "KSamplerAdvanced"
  );

  if (samplerNode && samplerNode.widgets_values) {
    // KSampler widget order: seed, control_after_generate, steps, cfg, sampler_name, scheduler, denoise
    // KSamplerAdvanced widget order: add_noise, noise_seed, control_after_generate, steps, cfg, sampler_name, scheduler, positive, negative, latent_image, denoise
    const values = samplerNode.widgets_values;

    if (samplerNode.type === "KSampler") {
      if (typeof values[2] === "number") settings.steps = values[2];
      if (typeof values[3] === "number") settings.cfg = values[3];
      if (typeof values[4] === "string") settings.sampler = values[4];
      if (typeof values[5] === "string") settings.scheduler = values[5];
      if (typeof values[6] === "number") settings.denoise = values[6];
    } else if (samplerNode.type === "KSamplerAdvanced") {
      if (typeof values[3] === "number") settings.steps = values[3];
      if (typeof values[4] === "number") settings.cfg = values[4];
      if (typeof values[5] === "string") settings.sampler = values[5];
      if (typeof values[6] === "string") settings.scheduler = values[6];
      if (typeof values[10] === "number") settings.denoise = values[10];
    }
  }

  return settings;
}

/**
 * Extract resolution from EmptyLatentImage or LoadImage nodes
 */
function extractResolution(workflow: ComfyUIWorkflow): {
  width?: number;
  height?: number;
  batchSize?: number;
} {
  const resolution: ReturnType<typeof extractResolution> = {};

  // Look for EmptyLatentImage node (most common for generation workflows)
  const latentNode = workflow.nodes.find((n) => n.type === "EmptyLatentImage");
  if (latentNode && latentNode.widgets_values) {
    // EmptyLatentImage widget order: width, height, batch_size
    if (typeof latentNode.widgets_values[0] === "number") {
      resolution.width = latentNode.widgets_values[0];
    }
    if (typeof latentNode.widgets_values[1] === "number") {
      resolution.height = latentNode.widgets_values[1];
    }
    if (typeof latentNode.widgets_values[2] === "number") {
      resolution.batchSize = latentNode.widgets_values[2];
    }
  }

  // Note: LoadImage nodes don't directly provide resolution info.
  // If no EmptyLatentImage is found, this is likely an img2img workflow
  // and resolution depends on the input image at runtime.

  return resolution;
}

/**
 * Extract workflow metadata from extra field
 */
function extractMetadata(workflow: ComfyUIWorkflow): {
  description?: string;
  author?: string;
  version?: string;
  tags?: string[];
} {
  const metadata: ReturnType<typeof extractMetadata> = {};

  if (workflow.extra) {
    // Check for common metadata fields
    if (typeof workflow.extra.description === "string") {
      metadata.description = workflow.extra.description;
    }
    if (typeof workflow.extra.author === "string") {
      metadata.author = workflow.extra.author;
    }
    if (typeof workflow.extra.version === "string") {
      metadata.version = workflow.extra.version;
    }
    if (Array.isArray(workflow.extra.tags)) {
      metadata.tags = workflow.extra.tags.filter((t): t is string => typeof t === "string");
    }

    // Some workflows use different field names
    if (!metadata.description && typeof workflow.extra.desc === "string") {
      metadata.description = workflow.extra.desc;
    }
    if (!metadata.author && typeof workflow.extra.creator === "string") {
      metadata.author = workflow.extra.creator;
    }
  }

  return metadata;
}

/**
 * Detect special features in the workflow
 */
function detectFeatures(workflow: ComfyUIWorkflow): {
  hasUpscaler: boolean;
  hasFaceDetailer: boolean;
  hasControlNet: boolean;
  hasIPAdapter: boolean;
  hasLora: boolean;
} {
  const features = {
    hasUpscaler: false,
    hasFaceDetailer: false,
    hasControlNet: false,
    hasIPAdapter: false,
    hasLora: false,
  };

  for (const node of workflow.nodes) {
    // Upscalers
    if (
      node.type.includes("Upscale") ||
      node.type === "UpscaleModelLoader" ||
      node.type === "ImageUpscaleWithModel"
    ) {
      features.hasUpscaler = true;
    }

    // Face detailers
    if (
      node.type.includes("FaceDetailer") ||
      node.type.includes("FaceRestore") ||
      node.type === "FaceRestoreCFWithModel"
    ) {
      features.hasFaceDetailer = true;
    }

    // ControlNet
    if (node.type.includes("ControlNet")) {
      features.hasControlNet = true;
    }

    // IP Adapter
    if (node.type.includes("IPAdapter")) {
      features.hasIPAdapter = true;
    }

    // LoRA
    if (node.type.includes("Lora") || node.type.includes("LoRA")) {
      features.hasLora = true;
    }
  }

  return features;
}

/**
 * Calculate complexity metrics
 */
function calculateComplexity(workflow: ComfyUIWorkflow): {
  nodeCount: number;
  connectionCount: number;
} {
  return {
    nodeCount: workflow.nodes.length,
    connectionCount: workflow.last_link_id || 0,
  };
}

/**
 * Parse a workflow JSON file
 */
export async function parseWorkflowFile(filepath: string): Promise<{
  workflow: NewWorkflow;
  dependencies: NewWorkflowDependency[];
} | null> {
  if (!existsSync(filepath)) {
    return null;
  }

  try {
    const content = await fs.readFile(filepath, "utf-8");
    const json = JSON.parse(content) as ComfyUIWorkflow;

    const filename = path.basename(filepath);
    const id = uuidv4();

    // Extract dependencies
    const extractedDeps = extractDependencies(json);

    // Extract comprehensive workflow data
    const samplerSettings = extractSamplerSettings(json);
    const resolution = extractResolution(json);
    const metadata = extractMetadata(json);
    const features = detectFeatures(json);
    const complexity = calculateComplexity(json);

    // Create workflow record
    const workflow: NewWorkflow = {
      id,
      filename,
      filepath,
      name: filename.replace(/\.json$/i, "").replace(/[-_]/g, " "),
      status: WORKFLOW_STATUS.NEW,
      totalDependencies: extractedDeps.length,
      resolvedLocal: 0,
      resolvedWarehouse: 0,
      missingCount: extractedDeps.length, // Initially all are missing
      totalSizeBytes: 0,
      estimatedVramGb: null,
      rawJson: content,

      // Workflow metadata
      description: metadata.description,
      author: metadata.author,
      version: metadata.version,
      tags: metadata.tags ? JSON.stringify(metadata.tags) : null,

      // Sampler settings
      steps: samplerSettings.steps,
      cfg: samplerSettings.cfg,
      scheduler: samplerSettings.scheduler,
      sampler: samplerSettings.sampler,
      denoise: samplerSettings.denoise,

      // Resolution
      width: resolution.width,
      height: resolution.height,
      batchSize: resolution.batchSize,

      // Special features
      hasUpscaler: features.hasUpscaler ? 1 : 0,
      hasFaceDetailer: features.hasFaceDetailer ? 1 : 0,
      hasControlNet: features.hasControlNet ? 1 : 0,
      hasIPAdapter: features.hasIPAdapter ? 1 : 0,
      hasLora: features.hasLora ? 1 : 0,

      // Complexity metrics
      nodeCount: complexity.nodeCount,
      connectionCount: complexity.connectionCount,

      // Timestamps
      createdAt: new Date().toISOString(),
      scannedAt: null,
      updatedAt: new Date().toISOString(),
    };

    // Create dependency records
    const dependencies: NewWorkflowDependency[] = extractedDeps.map((dep) => ({
      workflowId: id,
      nodeId: dep.nodeId,
      nodeType: dep.nodeType,
      modelType: dep.modelType,
      modelName: dep.modelName,
      resolvedModelId: null,
      status: DEP_STATUS.UNRESOLVED,
      civitaiUrl: null,
      huggingfaceUrl: null,
      estimatedSize: null,
      expectedArchitecture: null,
      compatibilityIssue: null,
    }));

    return { workflow, dependencies };
  } catch (error) {
    console.error(`Failed to parse workflow: ${filepath}`, error);
    return null;
  }
}

/**
 * Find all workflow JSON files in configured directories
 */
async function findWorkflowFiles(): Promise<string[]> {
  const files: string[] = [];

  for (const dir of CONFIG.paths.workflows) {
    if (!existsSync(dir)) {
      console.warn(`Workflow directory does not exist: ${dir}`);
      continue;
    }

    async function scanDir(dirPath: string) {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);

        if (entry.isDirectory()) {
          if (!entry.name.startsWith(".")) {
            await scanDir(fullPath);
          }
        } else if (entry.isFile() && entry.name.endsWith(".json")) {
          files.push(fullPath);
        }
      }
    }

    await scanDir(dir);
  }

  return files;
}

/**
 * Scan and index all workflows
 */
export async function scanWorkflows(): Promise<{
  scannedCount: number;
  newWorkflows: number;
  updatedWorkflows: number;
  totalDependencies: number;
}> {
  const result = {
    scannedCount: 0,
    newWorkflows: 0,
    updatedWorkflows: 0,
    totalDependencies: 0,
  };

  console.log("Scanning for workflow files...");
  const workflowFiles = await findWorkflowFiles();
  console.log(`Found ${workflowFiles.length} workflow files`);

  // Get existing workflows
  const existingWorkflows = new Map(
    db.select().from(workflows).all().map((w) => [w.filepath, w])
  );

  for (const filepath of workflowFiles) {
    result.scannedCount++;

    const existing = existingWorkflows.get(filepath);
    
    // Skip if already indexed and file hasn't changed
    if (existing) {
      try {
        const stats = await fs.stat(filepath);
        const mtime = stats.mtime.toISOString();
        if (existing.updatedAt && mtime <= existing.updatedAt) {
          continue; // No changes
        }
      } catch {
        // File might have been deleted
        continue;
      }
    }

    const parsed = await parseWorkflowFile(filepath);
    if (!parsed) continue;

    const { workflow, dependencies } = parsed;

    if (existing) {
      // Update existing workflow
      db.update(workflows)
        .set({
          ...workflow,
          id: existing.id,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(workflows.id, existing.id))
        .run();

      // Delete old dependencies and insert new ones
      db.delete(workflowDependencies)
        .where(eq(workflowDependencies.workflowId, existing.id))
        .run();

      for (const dep of dependencies) {
        db.insert(workflowDependencies)
          .values({ ...dep, workflowId: existing.id })
          .run();
      }

      result.updatedWorkflows++;
    } else {
      // Insert new workflow
      db.insert(workflows).values(workflow).run();

      // Insert dependencies
      for (const dep of dependencies) {
        db.insert(workflowDependencies).values(dep).run();
      }

      result.newWorkflows++;
    }

    result.totalDependencies += dependencies.length;
  }

  // Remove workflows that no longer exist
  const currentFilepaths = new Set(workflowFiles);
  for (const [filepath, workflow] of existingWorkflows) {
    if (!currentFilepaths.has(filepath)) {
      db.delete(workflows).where(eq(workflows.id, workflow.id)).run();
      console.log(`Removed missing workflow: ${filepath}`);
    }
  }

  console.log(
    `Workflow scan complete: ${result.newWorkflows} new, ${result.updatedWorkflows} updated`
  );

  return result;
}

/**
 * Get workflow with its dependencies
 */
export function getWorkflowWithDependencies(workflowId: string) {
  const workflow = db
    .select()
    .from(workflows)
    .where(eq(workflows.id, workflowId))
    .get();

  if (!workflow) return null;

  const deps = db
    .select()
    .from(workflowDependencies)
    .where(eq(workflowDependencies.workflowId, workflowId))
    .all();

  return { workflow, dependencies: deps };
}
