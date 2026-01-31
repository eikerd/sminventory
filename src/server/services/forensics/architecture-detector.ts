import { ARCHITECTURES } from "@/lib/config";
import type { SafetensorHeader } from "./safetensor-parser";

interface ArchitectureSignature {
  patterns: RegExp[];
  architecture: string;
  modelType: string;
  confidence: "high" | "medium" | "low";
}

/**
 * Signatures for detecting model architecture from tensor names
 * Order matters - more specific patterns should come first
 */
const SIGNATURES: ArchitectureSignature[] = [
  // === FLUX ===
  {
    patterns: [/double_blocks\.0/, /single_blocks\.0/, /transformer_blocks.*img_attn/],
    architecture: ARCHITECTURES.FLUX,
    modelType: "checkpoint",
    confidence: "high",
  },
  {
    patterns: [/lora.*transformer\.single_transformer_blocks/, /lora.*double_blocks/],
    architecture: ARCHITECTURES.FLUX,
    modelType: "lora",
    confidence: "high",
  },
  
  // === SD3 ===
  {
    patterns: [/model\.diffusion_model.*joint_blocks/, /joint_transformer_blocks/],
    architecture: ARCHITECTURES.SD3,
    modelType: "checkpoint",
    confidence: "high",
  },
  
  // === Wan Video ===
  {
    patterns: [/temporal_transformer/, /motion_modules/, /wan.*temporal/i],
    architecture: ARCHITECTURES.WAN,
    modelType: "diffusion_model",
    confidence: "high",
  },
  
  // === SDXL (check before SD1.5 since SDXL is a superset) ===
  {
    patterns: [
      /conditioner\.embedders\.1/, // Dual text encoder
      /model\.diffusion_model\.input_blocks\.0\.0\.weight/, // Combined with size check
    ],
    architecture: ARCHITECTURES.SDXL,
    modelType: "checkpoint",
    confidence: "medium", // Need size check to confirm
  },
  {
    patterns: [/lora_te2_/, /lora_unet.*_1280_/],
    architecture: ARCHITECTURES.SDXL,
    modelType: "lora",
    confidence: "high",
  },
  {
    patterns: [/controlnet_cond_embedding.*1280/, /control_model.*_1280/],
    architecture: ARCHITECTURES.SDXL,
    modelType: "controlnet",
    confidence: "high",
  },
  
  // === SD 1.5 ===
  {
    patterns: [/model\.diffusion_model\.input_blocks\.0\.0\.weight/],
    architecture: ARCHITECTURES.SD15,
    modelType: "checkpoint",
    confidence: "low", // Could also be SDXL
  },
  {
    patterns: [/lora_unet_down_blocks_0/, /lora_te_/],
    architecture: ARCHITECTURES.SD15,
    modelType: "lora",
    confidence: "medium",
  },
  {
    patterns: [/control_model\.input_blocks/, /control_model\.zero_convs/],
    architecture: ARCHITECTURES.SD15,
    modelType: "controlnet",
    confidence: "medium",
  },
  
  // === SVD (Stable Video Diffusion) ===
  {
    patterns: [/temporal_transformer/, /svd_/, /temporal_res_block/],
    architecture: ARCHITECTURES.SVD,
    modelType: "diffusion_model",
    confidence: "medium",
  },
  
  // === VAE (generic) ===
  {
    patterns: [/first_stage_model\.encoder/, /first_stage_model\.decoder/],
    architecture: ARCHITECTURES.UNKNOWN, // VAE is often architecture-agnostic
    modelType: "vae",
    confidence: "high",
  },
  
  // === CLIP ===
  {
    patterns: [/text_model\.encoder/, /clip_l/, /clip_g/],
    architecture: ARCHITECTURES.UNKNOWN,
    modelType: "clip",
    confidence: "medium",
  },
];

/**
 * Size-based hints for architecture detection
 * These help disambiguate when tensor patterns alone aren't enough
 */
const SIZE_HINTS: Record<string, { min: number; max: number; architecture: string }[]> = {
  checkpoint: [
    { min: 1.5e9, max: 3e9, architecture: ARCHITECTURES.SD15 },      // ~2GB for SD1.5
    { min: 5e9, max: 8e9, architecture: ARCHITECTURES.SDXL },        // ~6.5GB for SDXL
    { min: 10e9, max: 30e9, architecture: ARCHITECTURES.FLUX },      // ~12-24GB for Flux
    { min: 4e9, max: 6e9, architecture: ARCHITECTURES.SD3 },         // ~5GB for SD3 Medium
  ],
  lora: [
    { min: 1e6, max: 200e6, architecture: ARCHITECTURES.SD15 },      // SD1.5 LoRAs ~1-150MB
    { min: 200e6, max: 800e6, architecture: ARCHITECTURES.SDXL },    // SDXL LoRAs ~200-700MB
    { min: 100e6, max: 500e6, architecture: ARCHITECTURES.FLUX },    // Flux LoRAs vary
  ],
};

export interface DetectionResult {
  architecture: string;
  modelType: string;
  confidence: "high" | "medium" | "low";
  detectedFrom: "tensor_pattern" | "size_hint" | "metadata" | "unknown";
}

/**
 * Detect model architecture from safetensor header
 */
export function detectArchitectureFromHeader(
  header: SafetensorHeader,
  fileSize?: number
): DetectionResult {
  const tensorNames = Object.keys(header).filter((k) => k !== "__metadata__");
  const tensorNamesJoined = tensorNames.join("\n");
  
  // First, check embedded metadata for explicit architecture info
  const metadata = header.__metadata__ || {};
  if (metadata["modelspec.architecture"]) {
    const arch = parseModelSpecArchitecture(metadata["modelspec.architecture"]);
    if (arch) {
      return {
        architecture: arch.architecture,
        modelType: arch.modelType,
        confidence: "high",
        detectedFrom: "metadata",
      };
    }
  }
  
  // Check ss_base_model_version from kohya training
  if (metadata["ss_base_model_version"]) {
    const arch = parseBaseModelVersion(metadata["ss_base_model_version"]);
    if (arch) {
      return {
        architecture: arch,
        modelType: "lora",
        confidence: "high",
        detectedFrom: "metadata",
      };
    }
  }
  
  // Check tensor patterns
  for (const sig of SIGNATURES) {
    const matches = sig.patterns.some((pattern) => pattern.test(tensorNamesJoined));
    if (matches) {
      // For checkpoints, use size hints to improve confidence
      if (sig.modelType === "checkpoint" && fileSize && sig.confidence !== "high") {
        const sizeHint = SIZE_HINTS.checkpoint?.find(
          (h) => fileSize >= h.min && fileSize <= h.max
        );
        if (sizeHint && sizeHint.architecture === sig.architecture) {
          return {
            architecture: sig.architecture,
            modelType: sig.modelType,
            confidence: "high",
            detectedFrom: "tensor_pattern",
          };
        }
      }
      
      return {
        architecture: sig.architecture,
        modelType: sig.modelType,
        confidence: sig.confidence,
        detectedFrom: "tensor_pattern",
      };
    }
  }
  
  // Fallback to size-based detection for checkpoints
  if (fileSize) {
    for (const [modelType, hints] of Object.entries(SIZE_HINTS)) {
      for (const hint of hints) {
        if (fileSize >= hint.min && fileSize <= hint.max) {
          return {
            architecture: hint.architecture,
            modelType,
            confidence: "low",
            detectedFrom: "size_hint",
          };
        }
      }
    }
  }
  
  return {
    architecture: ARCHITECTURES.UNKNOWN,
    modelType: "unknown",
    confidence: "low",
    detectedFrom: "unknown",
  };
}

/**
 * Parse modelspec.architecture field
 */
function parseModelSpecArchitecture(
  value: string
): { architecture: string; modelType: string } | null {
  const lower = value.toLowerCase();
  
  if (lower.includes("flux")) {
    return { architecture: ARCHITECTURES.FLUX, modelType: "checkpoint" };
  }
  if (lower.includes("sd3") || lower.includes("stable-diffusion-3")) {
    return { architecture: ARCHITECTURES.SD3, modelType: "checkpoint" };
  }
  if (lower.includes("sdxl") || lower.includes("stable-diffusion-xl")) {
    return { architecture: ARCHITECTURES.SDXL, modelType: "checkpoint" };
  }
  if (lower.includes("sd-1") || lower.includes("stable-diffusion-v1")) {
    return { architecture: ARCHITECTURES.SD15, modelType: "checkpoint" };
  }
  
  return null;
}

/**
 * Parse ss_base_model_version field from kohya training
 */
function parseBaseModelVersion(value: string): string | null {
  const lower = value.toLowerCase();
  
  if (lower.includes("flux")) return ARCHITECTURES.FLUX;
  if (lower.includes("sdxl") || lower.includes("xl")) return ARCHITECTURES.SDXL;
  if (lower.includes("sd3")) return ARCHITECTURES.SD3;
  if (lower.includes("pony")) return ARCHITECTURES.PONY;
  if (lower.includes("v1") || lower.includes("1.5")) return ARCHITECTURES.SD15;
  
  return null;
}

/**
 * Detect model type from file path
 */
export function detectModelTypeFromPath(filepath: string): string {
  const lowerPath = filepath.toLowerCase();
  
  if (lowerPath.includes("/lora/") || lowerPath.includes("/lycori")) return "lora";
  if (lowerPath.includes("/vae/")) return "vae";
  if (lowerPath.includes("/controlnet/") || lowerPath.includes("/t2iadapter/")) return "controlnet";
  if (lowerPath.includes("/clip/") || lowerPath.includes("/textencoder")) return "clip";
  if (lowerPath.includes("/clipvision/")) return "clip_vision";
  if (lowerPath.includes("/embedding")) return "embedding";
  if (lowerPath.includes("/ipadapter")) return "ipadapter";
  if (lowerPath.includes("/esrgan/") || lowerPath.includes("/realesrgan/") || lowerPath.includes("/swinir/")) return "upscaler";
  if (lowerPath.includes("/diffusionmodel") || lowerPath.includes("/unet/")) return "diffusion_model";
  if (lowerPath.includes("/checkpoint/") || lowerPath.includes("/stablediffusion/")) return "checkpoint";
  
  return "unknown";
}

/**
 * Detect precision from filename or metadata
 */
export function detectPrecision(filename: string, metadata?: Record<string, string>): string {
  const lower = filename.toLowerCase();
  
  if (lower.includes("fp8") || lower.includes("_f8")) return "fp8";
  if (lower.includes("fp16") || lower.includes("_f16")) return "fp16";
  if (lower.includes("fp32") || lower.includes("_f32")) return "fp32";
  if (lower.includes("bf16")) return "bf16";
  if (lower.includes(".gguf") || lower.includes("q4") || lower.includes("q5") || lower.includes("q8")) return "gguf";
  
  // Check metadata
  if (metadata?.["modelspec.precision"]) {
    return metadata["modelspec.precision"];
  }
  
  // Default assumption based on common patterns
  if (lower.includes("safetensors")) return "fp16"; // Most safetensors are fp16
  
  return "unknown";
}
