import fs from "fs/promises";
import { existsSync } from "fs";

export interface SafetensorHeader {
  __metadata__?: Record<string, string>;
  [tensorName: string]: {
    dtype: string;
    shape: number[];
    data_offsets: [number, number];
  } | Record<string, string> | undefined;
}

export interface ParsedSafetensorInfo {
  header: SafetensorHeader;
  metadata: Record<string, string>;
  tensorNames: string[];
  tensorCount: number;
  headerSize: number;
}

/**
 * Read and parse the JSON header from a safetensor file
 * Safetensor format: [8 bytes: header size (u64 LE)] [header JSON] [tensor data]
 */
export async function readSafetensorHeader(filepath: string): Promise<ParsedSafetensorInfo | null> {
  if (!existsSync(filepath)) {
    return null;
  }

  const fileHandle = await fs.open(filepath, "r");
  
  try {
    // Read the first 8 bytes to get header size
    const headerSizeBuffer = Buffer.alloc(8);
    await fileHandle.read(headerSizeBuffer, 0, 8, 0);
    
    // Parse as little-endian uint64
    const headerSize = Number(headerSizeBuffer.readBigUInt64LE());
    
    // Sanity check - header shouldn't be larger than 100MB
    if (headerSize > 100 * 1024 * 1024) {
      console.warn(`Suspiciously large header size: ${headerSize} bytes for ${filepath}`);
      return null;
    }
    
    // Read the header JSON
    const headerBuffer = Buffer.alloc(headerSize);
    await fileHandle.read(headerBuffer, 0, headerSize, 8);
    
    // Parse JSON
    const header = JSON.parse(headerBuffer.toString("utf-8")) as SafetensorHeader;
    
    // Extract metadata and tensor names
    const metadata = header.__metadata__ || {};
    const tensorNames = Object.keys(header).filter(k => k !== "__metadata__");
    
    return {
      header,
      metadata,
      tensorNames,
      tensorCount: tensorNames.length,
      headerSize,
    };
  } catch (error) {
    console.error(`Failed to parse safetensor header for ${filepath}:`, error);
    return null;
  } finally {
    await fileHandle.close();
  }
}

/**
 * Check if a file is a valid safetensor by reading its header
 */
export async function isValidSafetensor(filepath: string): Promise<boolean> {
  try {
    const info = await readSafetensorHeader(filepath);
    return info !== null && info.tensorCount > 0;
  } catch {
    return false;
  }
}

/**
 * Extract embedded metadata from safetensor header
 * This includes training info (ss_* fields), modelspec fields, etc.
 */
export function extractEmbeddedMetadata(header: SafetensorHeader): {
  trainingInfo: Record<string, string>;
  modelSpec: Record<string, string>;
  triggerWords: string[];
  baseModel: string | null;
} {
  const metadata = header.__metadata__ || {};
  
  // Extract training info (ss_* fields from kohya training)
  const trainingInfo: Record<string, string> = {};
  const modelSpec: Record<string, string> = {};
  const triggerWords: string[] = [];
  let baseModel: string | null = null;
  
  for (const [key, value] of Object.entries(metadata)) {
    if (key.startsWith("ss_")) {
      trainingInfo[key] = value;
      
      // Extract base model from training info
      if (key === "ss_sd_model_name" || key === "ss_base_model_version") {
        baseModel = value;
      }
      
      // Extract tag frequency for trigger words
      if (key === "ss_tag_frequency") {
        try {
          const tagFreq = JSON.parse(value);
          for (const dataset of Object.values(tagFreq)) {
            if (typeof dataset === "object" && dataset !== null) {
              triggerWords.push(...Object.keys(dataset as Record<string, number>).slice(0, 10));
            }
          }
        } catch {
          // Ignore parse errors
        }
      }
    } else if (key.startsWith("modelspec.")) {
      modelSpec[key] = value;
      
      // modelspec.architecture tells us the model type
      if (key === "modelspec.architecture") {
        baseModel = value;
      }
    }
  }
  
  return {
    trainingInfo,
    modelSpec,
    triggerWords: [...new Set(triggerWords)], // Deduplicate
    baseModel,
  };
}

/**
 * Get file size in bytes
 */
export async function getFileSize(filepath: string): Promise<number> {
  const stats = await fs.stat(filepath);
  return stats.size;
}
