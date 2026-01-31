/**
 * CivitAI API Client
 * 
 * Provides methods for:
 * - Looking up models by SHA256 hash (identify unknown files)
 * - Getting model details by ID
 * - Getting download URLs
 * - Searching for models
 */

import { db } from "@/server/db";
import { settings } from "@/server/db/schema";
import { eq } from "drizzle-orm";

const CIVITAI_API_BASE = "https://civitai.com/api/v1";

export interface CivitAIModelVersion {
  id: number;
  modelId: number;
  name: string;
  createdAt: string;
  updatedAt: string;
  status: string;
  publishedAt: string;
  trainedWords: string[];
  baseModel: string;
  baseModelType: string;
  earlyAccessTimeFrame: number;
  description: string;
  stats: {
    downloadCount: number;
    ratingCount: number;
    rating: number;
    thumbsUpCount: number;
  };
  files: CivitAIFile[];
  images: CivitAIImage[];
  downloadUrl: string;
}

export interface CivitAIFile {
  id: number;
  sizeKB: number;
  name: string;
  type: string;
  pickleScanResult: string;
  pickleScanMessage: string;
  virusScanResult: string;
  virusScanMessage: string | null;
  scannedAt: string;
  metadata: {
    fp?: string;
    size?: string;
    format?: string;
  };
  hashes: {
    AutoV1?: string;
    AutoV2?: string;
    SHA256?: string;
    CRC32?: string;
    BLAKE3?: string;
    AutoV3?: string;
  };
  downloadUrl: string;
  primary: boolean;
}

export interface CivitAIImage {
  id: number;
  url: string;
  nsfwLevel: number;
  width: number;
  height: number;
  hash: string;
  type: string;
}

export interface CivitAIModel {
  id: number;
  name: string;
  description: string;
  type: string;
  poi: boolean;
  nsfw: boolean;
  allowNoCredit: boolean;
  allowCommercialUse: string[];
  allowDerivatives: boolean;
  allowDifferentLicense: boolean;
  stats: {
    downloadCount: number;
    favoriteCount: number;
    thumbsUpCount: number;
    commentCount: number;
    ratingCount: number;
    rating: number;
    tippedAmountCount: number;
  };
  creator: {
    username: string;
    image: string | null;
  };
  tags: string[];
  modelVersions: CivitAIModelVersion[];
}

export interface CivitAIHashLookupResult {
  modelVersion: CivitAIModelVersion;
  model: {
    id: number;
    name: string;
    type: string;
    nsfw: boolean;
  };
  file: CivitAIFile;
}

/**
 * Get CivitAI API key from settings
 */
async function getApiKey(): Promise<string | null> {
  const setting = db.select().from(settings).where(eq(settings.key, "civitai_api_key")).get();
  return setting?.value || process.env.CIVITAI_API_KEY || null;
}

/**
 * Make authenticated request to CivitAI API
 */
async function civitaiFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const apiKey = await getApiKey();
  
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...options.headers as Record<string, string>,
  };
  
  if (apiKey) {
    headers["Authorization"] = `Bearer ${apiKey}`;
  }
  
  const response = await fetch(`${CIVITAI_API_BASE}${endpoint}`, {
    ...options,
    headers,
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`CivitAI API error ${response.status}: ${errorText}`);
  }
  
  return response.json();
}

/**
 * Look up a model by its SHA256 hash
 * This is the key function for identifying unknown/renamed files
 */
export async function lookupByHash(hash: string): Promise<CivitAIHashLookupResult | null> {
  try {
    // CivitAI expects uppercase hash
    const normalizedHash = hash.toUpperCase();
    const result = await civitaiFetch<CivitAIModelVersion>(`/model-versions/by-hash/${normalizedHash}`);
    
    if (!result) return null;
    
    // Find the matching file in the version
    const matchingFile = result.files?.find(
      f => f.hashes?.SHA256?.toUpperCase() === normalizedHash
    );
    
    return {
      modelVersion: result,
      model: {
        id: result.modelId,
        name: "", // We'll need to fetch the full model for this
        type: result.baseModelType || "Unknown",
        nsfw: false,
      },
      file: matchingFile || result.files?.[0],
    };
  } catch (error) {
    console.error(`CivitAI hash lookup failed for ${hash}:`, error);
    return null;
  }
}

/**
 * Get full model details by model ID
 */
export async function getModel(modelId: number): Promise<CivitAIModel | null> {
  try {
    return await civitaiFetch<CivitAIModel>(`/models/${modelId}`);
  } catch (error) {
    console.error(`CivitAI get model failed for ${modelId}:`, error);
    return null;
  }
}

/**
 * Get model version details by version ID
 */
export async function getModelVersion(versionId: number): Promise<CivitAIModelVersion | null> {
  try {
    return await civitaiFetch<CivitAIModelVersion>(`/model-versions/${versionId}`);
  } catch (error) {
    console.error(`CivitAI get model version failed for ${versionId}:`, error);
    return null;
  }
}

/**
 * Search for models by query
 */
export async function searchModels(query: string, options: {
  limit?: number;
  types?: string[];
  sort?: "Highest Rated" | "Most Downloaded" | "Newest";
} = {}): Promise<{ items: CivitAIModel[]; metadata: { totalItems: number } }> {
  try {
    const params = new URLSearchParams({
      query,
      limit: String(options.limit || 20),
    });
    
    if (options.types?.length) {
      options.types.forEach(t => params.append("types", t));
    }
    if (options.sort) {
      params.set("sort", options.sort);
    }
    
    return await civitaiFetch<{ items: CivitAIModel[]; metadata: { totalItems: number } }>(
      `/models?${params.toString()}`
    );
  } catch (error) {
    console.error(`CivitAI search failed for "${query}":`, error);
    return { items: [], metadata: { totalItems: 0 } };
  }
}

/**
 * Get download URL for a model version
 * Returns the primary file's download URL
 */
export async function getDownloadUrl(versionId: number): Promise<string | null> {
  try {
    const version = await getModelVersion(versionId);
    if (!version) return null;
    
    // Find primary file or first file
    const file = version.files?.find(f => f.primary) || version.files?.[0];
    return file?.downloadUrl || version.downloadUrl || null;
  } catch (error) {
    console.error(`Failed to get download URL for version ${versionId}:`, error);
    return null;
  }
}

/**
 * Identify a model file by computing its hash and looking it up
 */
export async function identifyModelFile(hash: string): Promise<{
  identified: boolean;
  modelId?: number;
  versionId?: number;
  modelName?: string;
  versionName?: string;
  baseModel?: string;
  type?: string;
  triggerWords?: string[];
  downloadUrl?: string;
  expectedSize?: number;
} | null> {
  const result = await lookupByHash(hash);
  
  if (!result) {
    return { identified: false };
  }
  
  // Get full model details for the name
  const fullModel = await getModel(result.modelVersion.modelId);
  
  return {
    identified: true,
    modelId: result.modelVersion.modelId,
    versionId: result.modelVersion.id,
    modelName: fullModel?.name || `Model ${result.modelVersion.modelId}`,
    versionName: result.modelVersion.name,
    baseModel: result.modelVersion.baseModel,
    type: fullModel?.type,
    triggerWords: result.modelVersion.trainedWords,
    downloadUrl: result.file?.downloadUrl || result.modelVersion.downloadUrl,
    expectedSize: result.file?.sizeKB ? result.file.sizeKB * 1024 : undefined,
  };
}

/**
 * Map CivitAI model type to our internal type
 */
export function mapCivitAIType(civitaiType: string): string {
  const typeMap: Record<string, string> = {
    "Checkpoint": "checkpoint",
    "TextualInversion": "embedding",
    "Hypernetwork": "hypernetwork",
    "AestheticGradient": "aesthetic_gradient",
    "LORA": "lora",
    "LoCon": "lora",
    "DoRA": "lora",
    "Controlnet": "controlnet",
    "Upscaler": "upscaler",
    "MotionModule": "motion_module",
    "VAE": "vae",
    "Poses": "poses",
    "Wildcards": "wildcards",
    "Workflows": "workflow",
    "Other": "other",
  };
  
  return typeMap[civitaiType] || "unknown";
}

/**
 * Map CivitAI base model to our architecture
 */
export function mapCivitAIBaseModel(baseModel: string): string {
  const archMap: Record<string, string> = {
    "SD 1.4": "SD15",
    "SD 1.5": "SD15",
    "SD 1.5 LCM": "SD15",
    "SD 1.5 Hyper": "SD15",
    "SD 2.0": "SD20",
    "SD 2.0 768": "SD20",
    "SD 2.1": "SD21",
    "SD 2.1 768": "SD21",
    "SD 2.1 Unclip": "SD21",
    "SDXL 0.9": "SDXL",
    "SDXL 1.0": "SDXL",
    "SDXL 1.0 LCM": "SDXL",
    "SDXL Distilled": "SDXL",
    "SDXL Hyper": "SDXL",
    "SDXL Lightning": "SDXL",
    "SDXL Turbo": "SDXL",
    "SD 3": "SD3",
    "SD 3.5": "SD3",
    "SD 3.5 Large": "SD3",
    "SD 3.5 Large Turbo": "SD3",
    "SD 3.5 Medium": "SD3",
    "Pony": "Pony",
    "Flux.1 S": "Flux",
    "Flux.1 D": "Flux",
    "Flux.1 Schnell": "Flux",
    "Flux.1 Dev": "Flux",
    "SVD": "SVD",
    "SVD XT": "SVD",
    "Stable Cascade": "Cascade",
    "PixArt a": "PixArt",
    "PixArt E": "PixArt",
    "Hunyuan 1": "Hunyuan",
    "Hunyuan Video": "Hunyuan",
    "Lumina": "Lumina",
    "Kolors": "Kolors",
    "IllustriousXL": "Illustrious",
    "Mochi": "Mochi",
    "LTXV": "LTX",
    "CogVideoX": "CogVideo",
    "Wan Video 2.1": "Wan",
    "Wan Video 2.1 T2V": "Wan",
    "Wan Video 2.1 I2V": "Wan",
  };
  
  // Try exact match first
  if (archMap[baseModel]) {
    return archMap[baseModel];
  }
  
  // Try partial match
  const lowerBase = baseModel.toLowerCase();
  if (lowerBase.includes("flux")) return "Flux";
  if (lowerBase.includes("sdxl") || lowerBase.includes("xl")) return "SDXL";
  if (lowerBase.includes("sd3") || lowerBase.includes("sd 3")) return "SD3";
  if (lowerBase.includes("pony")) return "Pony";
  if (lowerBase.includes("wan")) return "Wan";
  if (lowerBase.includes("sd 1") || lowerBase.includes("sd1")) return "SD15";
  if (lowerBase.includes("sd 2") || lowerBase.includes("sd2")) return "SD20";
  
  return "unknown";
}
