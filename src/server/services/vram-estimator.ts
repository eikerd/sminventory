/**
 * VRAM Estimation Service
 * 
 * Estimates VRAM requirements for workflows based on their model dependencies.
 * This helps users know if a workflow will fit on their GPU.
 */

import { ARCHITECTURES } from "@/lib/config";

// VRAM estimation factors based on model type and precision
const VRAM_FACTORS: Record<string, Record<string, (sizeGB: number) => number>> = {
  checkpoint: {
    fp32: (sizeGB) => sizeGB * 1.2,    // Full precision + overhead
    fp16: (sizeGB) => sizeGB * 1.1,    // Half precision
    bf16: (sizeGB) => sizeGB * 1.1,
    fp8: (sizeGB) => sizeGB * 0.6,     // 8-bit
    gguf: (sizeGB) => sizeGB * 0.5,    // Quantized
    unknown: (sizeGB) => sizeGB * 1.1, // Assume fp16
  },
  diffusion_model: {
    fp32: (sizeGB) => sizeGB * 1.2,
    fp16: (sizeGB) => sizeGB * 1.1,
    bf16: (sizeGB) => sizeGB * 1.1,
    fp8: (sizeGB) => sizeGB * 0.6,
    gguf: (sizeGB) => sizeGB * 0.5,
    unknown: (sizeGB) => sizeGB * 1.1,
  },
  lora: {
    // LoRAs add minimal VRAM overhead
    fp16: (sizeGB) => sizeGB * 0.15,
    fp32: (sizeGB) => sizeGB * 0.2,
    unknown: (sizeGB) => sizeGB * 0.15,
  },
  vae: {
    // VAEs are relatively small
    fp16: () => 0.5,
    fp32: () => 1.0,
    unknown: () => 0.5,
  },
  controlnet: {
    // ControlNets can be significant
    fp16: (sizeGB) => sizeGB * 1.0,
    fp32: (sizeGB) => sizeGB * 1.2,
    unknown: (sizeGB) => sizeGB * 1.0,
  },
  clip: {
    // Text encoders
    fp16: (sizeGB) => sizeGB * 1.0,
    fp32: (sizeGB) => sizeGB * 1.2,
    unknown: (sizeGB) => sizeGB * 1.0,
  },
  clip_vision: {
    fp16: (sizeGB) => sizeGB * 1.0,
    fp32: (sizeGB) => sizeGB * 1.2,
    unknown: (sizeGB) => sizeGB * 1.0,
  },
  ipadapter: {
    fp16: (sizeGB) => sizeGB * 0.8,
    fp32: (sizeGB) => sizeGB * 1.0,
    unknown: (sizeGB) => sizeGB * 0.8,
  },
  upscaler: {
    // Upscalers are typically small
    fp16: () => 0.2,
    fp32: () => 0.3,
    unknown: () => 0.2,
  },
  embedding: {
    // Embeddings are tiny
    fp16: () => 0.01,
    fp32: () => 0.01,
    unknown: () => 0.01,
  },
};

// Base VRAM overhead for ComfyUI itself
const BASE_OVERHEAD_GB = 1.5;

// Additional overhead during generation (activations, gradients, etc.)
const GENERATION_OVERHEAD_FACTOR = 1.3;

// Architecture-specific base requirements
const ARCHITECTURE_BASE_VRAM: Record<string, number> = {
  [ARCHITECTURES.SD15]: 4.0,
  [ARCHITECTURES.SDXL]: 8.0,
  [ARCHITECTURES.SD3]: 10.0,
  [ARCHITECTURES.FLUX]: 12.0,
  [ARCHITECTURES.PONY]: 8.0,
  [ARCHITECTURES.WAN]: 14.0,
  [ARCHITECTURES.SVD]: 10.0,
  [ARCHITECTURES.UNKNOWN]: 8.0,
};

export interface ModelDependency {
  type: string;
  precision: string;
  sizeBytes: number;
  architecture?: string;
}

export interface VRAMEstimate {
  baseVram: number;           // Just the models
  withOverhead: number;       // Including generation overhead
  peakEstimate: number;       // Maximum expected during generation
  breakdown: {
    type: string;
    count: number;
    vram: number;
  }[];
  warnings: string[];
  canRunOn: {
    vram16gb: boolean;
    vram24gb: boolean;
    vram48gb: boolean;
    vram80gb: boolean;
  };
}

/**
 * Estimate VRAM usage for a single model
 */
export function estimateModelVRAM(
  type: string,
  precision: string,
  sizeBytes: number
): number {
  const sizeGB = sizeBytes / (1024 * 1024 * 1024);
  
  const typeFactor = VRAM_FACTORS[type] || VRAM_FACTORS.checkpoint;
  const precisionFactor = typeFactor[precision] || typeFactor.unknown;
  
  return precisionFactor(sizeGB);
}

/**
 * Estimate total VRAM for a workflow's dependencies
 */
export function estimateWorkflowVRAM(dependencies: ModelDependency[]): VRAMEstimate {
  let baseVram = BASE_OVERHEAD_GB;
  const breakdown: Record<string, { count: number; vram: number }> = {};
  const warnings: string[] = [];
  
  // Track architecture for base requirements
  let primaryArchitecture: string = ARCHITECTURES.UNKNOWN;
  let loraCount = 0;
  let controlnetCount = 0;
  
  for (const dep of dependencies) {
    const vram = estimateModelVRAM(dep.type, dep.precision, dep.sizeBytes);
    baseVram += vram;
    
    // Track for breakdown
    if (!breakdown[dep.type]) {
      breakdown[dep.type] = { count: 0, vram: 0 };
    }
    breakdown[dep.type].count++;
    breakdown[dep.type].vram += vram;
    
    // Track specific types
    if (dep.type === "lora") loraCount++;
    if (dep.type === "controlnet") controlnetCount++;
    
    // Get primary architecture from checkpoint
    if ((dep.type === "checkpoint" || dep.type === "diffusion_model") && dep.architecture) {
      primaryArchitecture = dep.architecture;
    }
  }
  
  // Add warnings
  if (loraCount > 3) {
    warnings.push(`${loraCount} LoRAs may cause instability or slow generation`);
  }
  if (controlnetCount > 2) {
    warnings.push(`${controlnetCount} ControlNets will significantly increase VRAM usage`);
  }
  
  // Check against architecture minimum
  const archMinimum = ARCHITECTURE_BASE_VRAM[primaryArchitecture] || ARCHITECTURE_BASE_VRAM[ARCHITECTURES.UNKNOWN];
  if (baseVram < archMinimum) {
    // The estimate seems low, use architecture minimum
    baseVram = Math.max(baseVram, archMinimum * 0.8);
  }
  
  // Calculate with overhead
  const withOverhead = baseVram * GENERATION_OVERHEAD_FACTOR;
  const peakEstimate = withOverhead * 1.2; // Extra margin for peak usage
  
  // Determine compatibility
  const canRunOn = {
    vram16gb: peakEstimate <= 14, // Leave 2GB buffer
    vram24gb: peakEstimate <= 22,
    vram48gb: peakEstimate <= 46,
    vram80gb: peakEstimate <= 78,
  };
  
  if (!canRunOn.vram16gb && !canRunOn.vram24gb) {
    warnings.push("This workflow may require a high-VRAM GPU (48GB+)");
  } else if (!canRunOn.vram16gb) {
    warnings.push("This workflow may not fit on a 16GB GPU");
  }
  
  return {
    baseVram: Math.round(baseVram * 10) / 10,
    withOverhead: Math.round(withOverhead * 10) / 10,
    peakEstimate: Math.round(peakEstimate * 10) / 10,
    breakdown: Object.entries(breakdown).map(([type, data]) => ({
      type,
      count: data.count,
      vram: Math.round(data.vram * 10) / 10,
    })),
    warnings,
    canRunOn,
  };
}

/**
 * Get recommended precision for a given VRAM limit
 */
export function getRecommendedPrecision(
  targetVramGB: number,
  architecture: string
): string {
  const archMinimum = ARCHITECTURE_BASE_VRAM[architecture] || 8;
  
  if (targetVramGB >= archMinimum * 2) {
    return "fp16"; // Plenty of room
  } else if (targetVramGB >= archMinimum * 1.5) {
    return "fp16"; // Should fit
  } else if (targetVramGB >= archMinimum) {
    return "fp8"; // Tight fit, use fp8
  } else {
    return "gguf"; // Very constrained, use quantized
  }
}

/**
 * Check if a workflow will fit in available VRAM
 */
export function checkVRAMFit(
  estimate: VRAMEstimate,
  availableVramGB: number
): {
  fits: boolean;
  margin: number;
  recommendation: string;
} {
  const margin = availableVramGB - estimate.peakEstimate;
  const fits = margin >= 1; // At least 1GB buffer
  
  let recommendation = "";
  if (!fits) {
    if (margin > -2) {
      recommendation = "Consider using fp8 precision or removing some LoRAs";
    } else if (margin > -5) {
      recommendation = "Consider using GGUF quantized models or a cloud GPU";
    } else {
      recommendation = "This workflow requires significantly more VRAM - use cloud deployment";
    }
  } else if (margin < 3) {
    recommendation = "Should fit but may be tight - close other GPU applications";
  } else {
    recommendation = "Good fit with comfortable margin";
  }
  
  return {
    fits,
    margin: Math.round(margin * 10) / 10,
    recommendation,
  };
}
