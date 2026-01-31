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
