import path from "path";

export const CONFIG = {
  server: {
    port: 6660,
  },
  paths: {
    stabilityMatrix: "/mnt/e/StabilityMatrix",
    models: "/mnt/e/StabilityMatrix/Data/Models",
    workflows: [
      "/mnt/e/StabilityMatrix/Data/Workflows",
      "/mnt/e/StabilityMatrix/Data/Packages/ComfyUI/user/default/workflows",
    ],
    warehouse: "/mnt/d/models", // Cloud warehouse with mirrored structure
    database: path.join(process.cwd(), "data", "sminventory.db"),
  },
  validation: {
    defaultLevel: "standard" as "quick" | "standard" | "full",
  },
  // Model type to directory mapping (from extra_model_paths.yaml)
  modelTypeMap: {
    checkpoint: ["StableDiffusion"],
    lora: ["Lora", "LyCORIS"],
    vae: ["VAE"],
    controlnet: ["ControlNet", "T2IAdapter"],
    clip: ["TextEncoders"],
    clip_vision: ["ClipVision"],
    upscaler: ["ESRGAN", "RealESRGAN", "SwinIR"],
    embedding: ["Embeddings"],
    ipadapter: ["IpAdapter", "IpAdapters15", "IpAdaptersXl"],
    diffusion_model: ["DiffusionModels"],
    ultralytics: ["Ultralytics"],
  },
  // File extensions we care about
  modelExtensions: [".safetensors", ".ckpt", ".pt", ".pth", ".bin", ".gguf"],
  // ComfyUI node types and what model type they use
  nodeModelMapping: {
    // Checkpoints
    CheckpointLoaderSimple: { modelType: "checkpoint", field: "ckpt_name" },
    CheckpointLoader: { modelType: "checkpoint", field: "ckpt_name" },
    UNETLoader: { modelType: "diffusion_model", field: "unet_name" },
    
    // LoRA
    LoraLoader: { modelType: "lora", field: "lora_name" },
    LoraLoaderModelOnly: { modelType: "lora", field: "lora_name" },
    
    // VAE
    VAELoader: { modelType: "vae", field: "vae_name" },
    
    // ControlNet
    ControlNetLoader: { modelType: "controlnet", field: "control_net_name" },
    DiffControlNetLoader: { modelType: "controlnet", field: "control_net_name" },
    
    // CLIP
    CLIPLoader: { modelType: "clip", field: "clip_name" },
    DualCLIPLoader: { modelType: "clip", field: ["clip_name1", "clip_name2"] },
    CLIPVisionLoader: { modelType: "clip_vision", field: "clip_name" },
    
    // Upscale
    UpscaleModelLoader: { modelType: "upscaler", field: "model_name" },
    
    // IP Adapter
    IPAdapterModelLoader: { modelType: "ipadapter", field: "ipadapter_file" },
    
    // Special loaders (Wan, etc.)
    DownloadAndLoadWanModel: { modelType: "diffusion_model", field: "model" },
  },
};

// Workflow status enum
export const WORKFLOW_STATUS = {
  NEW: "new",
  SCANNED_MISSING: "scanned-missing-items",
  SCANNED_ERROR: "scanned-error",
  SCANNED_READY_LOCAL: "scanned-ready-local",
  SCANNED_READY_CLOUD: "scanned-ready-cloud",
} as const;

// Hash status enum
export const HASH_STATUS = {
  PENDING: "pending",
  VALID: "valid",
  CORRUPT: "corrupt",
  INCOMPLETE: "incomplete",
  UNKNOWN: "unknown",
} as const;

// Dependency resolution status
export const DEP_STATUS = {
  UNRESOLVED: "unresolved",
  RESOLVED_LOCAL: "resolved-local",
  RESOLVED_WAREHOUSE: "resolved-warehouse",
  MISSING: "missing",
  AMBIGUOUS: "ambiguous",
  INCOMPATIBLE: "incompatible",
} as const;

// Architecture identifiers
export const ARCHITECTURES = {
  SD15: "SD15",
  SDXL: "SDXL",
  SD3: "SD3",
  FLUX: "Flux",
  PONY: "Pony",
  WAN: "Wan",
  SVD: "SVD",
  UNKNOWN: "unknown",
} as const;

// Task status enum
export const TASK_STATUS = {
  PENDING: "pending",
  RUNNING: "running",
  PAUSED: "paused",
  COMPLETED: "completed",
  FAILED: "failed",
  CANCELLED: "cancelled",
} as const;

// Task type enum
export const TASK_TYPE = {
  DOWNLOAD: "download",
  MODEL_SCAN: "model_scan",
  WORKFLOW_SCAN: "workflow_scan",
  DEPENDENCY_RESOLUTION: "dependency_resolution",
  HASH_VALIDATION: "hash_validation",
} as const;

// ═══════════════════════════════════════════════════════════════════
// VIDEO TAG TAXONOMY (matching CivitAI)
// ═══════════════════════════════════════════════════════════════════

export const VIDEO_TAG_CATEGORIES = {
  MODEL_TYPE: "model_type",
  BASE_MODEL: "base_model",
  CUSTOM: "custom",
} as const;

// Model types matching CivitAI taxonomy
export const MODEL_TYPES = [
  "Checkpoint", "Embedding", "Hypernetwork", "Aesthetic Gradient",
  "LoRA", "LyCORIS", "DoRA", "Controlnet", "Upscaler", "Motion",
  "VAE", "Poses", "Wildcards", "Workflows", "Detection", "Other",
] as const;

// Base models matching CivitAI taxonomy (from screenshot)
export const BASE_MODELS = [
  "Anima", "Aura Flow", "Chroma", "CogVideoX",
  "Flux .1 S", "Flux .1 D", "Flux .1 Krea", "Flux .1 Kontext",
  "Flux .2 D", "Flux .2 Klein 9B", "Flux .2 Klein 9B-base",
  "Flux .2 Klein 4B", "Flux .2 Klein 4B-base",
  "HiDream", "Hunyuan 1", "Hunyuan Video",
  "Illustrious", "Kolors", "LTXV", "LTXV2", "Lumina", "Mochi",
  "NoobAI", "Other", "PixArt α", "PixArt Σ", "Pony", "Pony V7",
  "Qwen", "SD 1.4", "SD 1.5", "SD 1.5 LCM", "SD 1.5 Hyper",
  "SD 2.0", "SD 2.1", "SDXL 1.0", "SDXL Lightning", "SDXL Hyper",
  "Wan Video 1.3B t2v", "Wan Video 14B t2v",
  "Wan Video 14B i2v 480p", "Wan Video 14B i2v 720p",
  "Wan Video 2.2 TI2V-5B", "Wan Video 2.2 I2V-A14B",
  "Wan Video 2.2 T2V-A14B", "Wan Video 2.5 T2V", "Wan Video 2.5 I2V",
  "Z Image Turbo", "Z Image Base",
] as const;

// Map internal architecture codes to CivitAI base model display names
// Note: Returns values from BASE_MODELS constant or "Other" for unmapped architectures
export function mapArchitectureToBaseModel(arch: string): string | null {
  const map: Record<string, string> = {
    "SD15": "SD 1.5",
    "SD20": "SD 2.0",
    "SD21": "SD 2.1",
    "SDXL": "SDXL 1.0",
    "SD3": "Other", // SD 3 not in taxonomy yet, map to Other
    "Flux": "Flux .1 D",
    "Pony": "Pony",
    "Wan": "Wan Video 14B t2v",
    "SVD": "Other", // SVD not in taxonomy yet, map to Other
    "Cascade": "Other", // Stable Cascade not in taxonomy yet, map to Other
    "Hunyuan": "Hunyuan 1",
    "Illustrious": "Illustrious",
    "Kolors": "Kolors",
    "LTX": "LTXV",
    "CogVideo": "CogVideoX",
    "Mochi": "Mochi",
    "Lumina": "Lumina",
    "PixArt": "PixArt α",
  };
  return map[arch] || "Other";
}

// Map internal model type codes to CivitAI display names
export function mapModelTypeToDisplay(type: string): string | null {
  const map: Record<string, string> = {
    "checkpoint": "Checkpoint",
    "lora": "LoRA",
    "vae": "VAE",
    "controlnet": "Controlnet",
    "clip": "Checkpoint",
    "clip_vision": "Checkpoint",
    "upscaler": "Upscaler",
    "embedding": "Embedding",
    "ipadapter": "Controlnet",
    "diffusion_model": "Checkpoint",
    "hypernetwork": "Hypernetwork",
    "motion_module": "Motion",
    "poses": "Poses",
    "wildcards": "Wildcards",
    "ultralytics": "Detection",
  };
  return map[type] || null;
}

export const TAG_SOURCE = {
  AUTO: "auto",
  MANUAL: "manual",
} as const;

export const URL_SOURCE = {
  SCRAPED: "scraped",
  MANUAL: "manual",
} as const;
