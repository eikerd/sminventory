import fs from "fs/promises";
import path from "path";
import { existsSync } from "fs";
import { v4 as uuidv4 } from "uuid";
import { db } from "@/server/db";
import { models, scanLog, type NewModel } from "@/server/db/schema";
import { CONFIG, HASH_STATUS } from "@/lib/config";
import { analyzeModel, quickScanModel, calculatePartialHash } from "./forensics";
import { eq } from "drizzle-orm";

const MODEL_EXTENSIONS = new Set(CONFIG.modelExtensions);

interface ScanOptions {
  location: "local" | "warehouse";
  validationLevel: "quick" | "standard" | "full";
  forceRescan?: boolean;
}

interface ScanResult {
  scannedCount: number;
  newModels: number;
  updatedModels: number;
  errors: string[];
  duration: number;
}

/**
 * Recursively find all model files in a directory
 */
async function findModelFiles(dirPath: string): Promise<string[]> {
  const files: string[] = [];

  if (!existsSync(dirPath)) {
    console.warn(`Directory does not exist: ${dirPath}`);
    return files;
  }

  async function scanDir(dir: string) {
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        // Skip hidden directories and cache folders
        if (!entry.name.startsWith(".") && entry.name !== "node_modules") {
          await scanDir(fullPath);
        }
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (MODEL_EXTENSIONS.has(ext)) {
          files.push(fullPath);
        }
      }
    }
  }

  await scanDir(dirPath);
  return files;
}

/**
 * Load CivitAI metadata from .cm-info.json sidecar file if it exists
 */
async function loadCivitAIMetadata(modelPath: string): Promise<{
  modelId?: number;
  versionId?: number;
  name?: string;
  baseModel?: string;
  expectedHash?: string;
} | null> {
  // Try different naming patterns for cm-info files
  const basePath = modelPath.replace(/\.[^/.]+$/, "");
  const possiblePaths = [
    `${basePath}.cm-info.json`,
    `${modelPath}.cm-info.json`,
  ];

  for (const cmInfoPath of possiblePaths) {
    if (existsSync(cmInfoPath)) {
      try {
        const content = await fs.readFile(cmInfoPath, "utf-8");
        const data = JSON.parse(content);

        return {
          modelId: data.ModelId,
          versionId: data.VersionId,
          name: data.ModelName,
          baseModel: data.BaseModel,
          expectedHash: data.Hashes?.SHA256,
        };
      } catch (error) {
        console.error(`Failed to parse cm-info file: ${cmInfoPath}`, error);
      }
    }
  }

  return null;
}

/**
 * Index a single model file
 */
async function indexModelFile(
  filepath: string,
  location: "local" | "warehouse",
  validationLevel: "quick" | "standard" | "full"
): Promise<NewModel | null> {
  try {
    // Perform forensic analysis
    const analysis = await analyzeModel(filepath, {
      calculateFullHash: validationLevel === "full",
      calculatePartialHash: validationLevel !== "quick",
      skipValidation: false,
    });

    if (!analysis) {
      return null;
    }

    // Load CivitAI metadata if available
    const civitaiMeta = await loadCivitAIMetadata(filepath);

    // Determine hash status
    let hashStatus: string = HASH_STATUS.PENDING;
    if (!analysis.isValid) {
      hashStatus = HASH_STATUS.CORRUPT;
    } else if (validationLevel !== "quick" && analysis.partialHash) {
      hashStatus = HASH_STATUS.VALID;
    }

    // Use SHA256 hash as ID if we have it, otherwise generate UUID
    const id = analysis.fullHash || analysis.partialHash || uuidv4();

    const model: NewModel = {
      id,
      filename: analysis.filename,
      filepath: analysis.filepath,
      location,
      detectedType: analysis.detectedType,
      detectedArchitecture: analysis.detectedArchitecture,
      detectedPrecision: analysis.detectedPrecision,
      fileSize: analysis.fileSize,
      hashStatus,
      expectedHash: civitaiMeta?.expectedHash || null,
      partialHash: analysis.partialHash,
      civitaiModelId: civitaiMeta?.modelId || null,
      civitaiVersionId: civitaiMeta?.versionId || null,
      civitaiName: civitaiMeta?.name || null,
      civitaiBaseModel: civitaiMeta?.baseModel || analysis.detectedArchitecture,
      embeddedMetadata: JSON.stringify(analysis.embeddedMetadata),
      triggerWords: analysis.triggerWords.join(", ") || null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    return model;
  } catch (error) {
    console.error(`Failed to index model: ${filepath}`, error);
    return null;
  }
}

/**
 * Scan a directory and index all model files
 */
export async function scanModelsDirectory(
  dirPath: string,
  options: ScanOptions
): Promise<ScanResult> {
  const startTime = Date.now();
  const result: ScanResult = {
    scannedCount: 0,
    newModels: 0,
    updatedModels: 0,
    errors: [],
    duration: 0,
  };

  console.log(`Starting scan of ${dirPath} (${options.location}, validation: ${options.validationLevel})`);

  // Find all model files
  const modelFiles = await findModelFiles(dirPath);
  console.log(`Found ${modelFiles.length} model files`);

  // Get existing models for this location
  const existingModels = new Map(
    db
      .select()
      .from(models)
      .where(eq(models.location, options.location))
      .all()
      .map((m) => [m.filepath, m])
  );

  // Process files in batches to avoid memory issues
  const BATCH_SIZE = 20;
  for (let i = 0; i < modelFiles.length; i += BATCH_SIZE) {
    const batch = modelFiles.slice(i, i + BATCH_SIZE);
    
    const batchPromises = batch.map(async (filepath) => {
      result.scannedCount++;

      // Check if model already exists and hasn't changed
      const existing = existingModels.get(filepath);
      if (existing && !options.forceRescan) {
        // Quick check - if file size matches, assume unchanged
        try {
          const stats = await fs.stat(filepath);
          if (stats.size === existing.fileSize) {
            return; // Skip - no changes
          }
        } catch {
          // File might have been deleted
        }
      }

      const model = await indexModelFile(filepath, options.location, options.validationLevel);
      
      if (model) {
        // Upsert the model
        if (existing) {
          db.update(models)
            .set({
              ...model,
              id: existing.id, // Keep the existing ID
              updatedAt: new Date().toISOString(),
            })
            .where(eq(models.id, existing.id))
            .run();
          result.updatedModels++;
        } else {
          db.insert(models)
            .values(model)
            .onConflictDoUpdate({
              target: models.id,
              set: {
                ...model,
                updatedAt: new Date().toISOString(),
              },
            })
            .run();
          result.newModels++;
        }
      }
    });

    await Promise.all(batchPromises);
    
    // Progress logging
    const progress = Math.round((i / modelFiles.length) * 100);
    console.log(`Scan progress: ${progress}% (${i}/${modelFiles.length})`);
  }

  // Remove models that no longer exist on disk
  const currentFilepaths = new Set(modelFiles);
  for (const [filepath, model] of existingModels) {
    if (!currentFilepaths.has(filepath)) {
      db.delete(models).where(eq(models.id, model.id)).run();
      console.log(`Removed missing model: ${filepath}`);
    }
  }

  // Total size of all models in this location (not just this directory), since
  // locations like "local" may span multiple subdirectories under one root
  const allLocationModels = db
    .select()
    .from(models)
    .where(eq(models.location, options.location))
    .all();
  const totalSize = allLocationModels.reduce((sum, m) => sum + m.fileSize, 0);

  // Log the scan
  db.insert(scanLog)
    .values({
      path: dirPath,
      fileCount: modelFiles.length,
      totalSize,
      scannedAt: new Date().toISOString(),
    })
    .run();

  result.duration = Date.now() - startTime;
  console.log(`Scan complete: ${result.newModels} new, ${result.updatedModels} updated in ${result.duration}ms`);

  return result;
}

/**
 * Scan both local and warehouse directories
 */
export async function scanAllModels(
  validationLevel: "quick" | "standard" | "full" = "standard",
  forceRescan = false
): Promise<{ local: ScanResult; warehouse: ScanResult }> {
  const localResult = await scanModelsDirectory(CONFIG.paths.models, {
    location: "local",
    validationLevel,
    forceRescan,
  });

  let warehouseResult: ScanResult = {
    scannedCount: 0,
    newModels: 0,
    updatedModels: 0,
    errors: [],
    duration: 0,
  };

  // Only scan warehouse if it exists
  if (existsSync(CONFIG.paths.warehouse)) {
    warehouseResult = await scanModelsDirectory(CONFIG.paths.warehouse, {
      location: "warehouse",
      validationLevel,
      forceRescan,
    });
  } else {
    console.log(`Warehouse directory does not exist: ${CONFIG.paths.warehouse}`);
  }

  return { local: localResult, warehouse: warehouseResult };
}

/**
 * Get model statistics
 */
export function getModelStats(): {
  total: number;
  byLocation: Record<string, number>;
  byType: Record<string, number>;
  byArchitecture: Record<string, number>;
  byStatus: Record<string, number>;
  totalSize: number;
} {
  const allModels = db.select().from(models).all();

  const byLocation: Record<string, number> = {};
  const byType: Record<string, number> = {};
  const byArchitecture: Record<string, number> = {};
  const byStatus: Record<string, number> = {};
  let totalSize = 0;

  for (const model of allModels) {
    byLocation[model.location] = (byLocation[model.location] || 0) + 1;
    byType[model.detectedType || "unknown"] = (byType[model.detectedType || "unknown"] || 0) + 1;
    byArchitecture[model.detectedArchitecture || "unknown"] = (byArchitecture[model.detectedArchitecture || "unknown"] || 0) + 1;
    byStatus[model.hashStatus || "pending"] = (byStatus[model.hashStatus || "pending"] || 0) + 1;
    totalSize += model.fileSize;
  }

  return {
    total: allModels.length,
    byLocation,
    byType,
    byArchitecture,
    byStatus,
    totalSize,
  };
}
