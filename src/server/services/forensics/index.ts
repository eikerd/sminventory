/**
 * Forensics Module - Model Identification and Validation
 * 
 * This module provides tools for:
 * - Parsing safetensor file headers
 * - Calculating file hashes (full and partial)
 * - Detecting model architecture from tensor patterns
 * - Extracting embedded metadata
 * - Looking up models on CivitAI by hash
 */

import path from "path";
import fs from "fs/promises";
import { existsSync } from "fs";

import {
  readSafetensorHeader,
  extractEmbeddedMetadata,
  getFileSize,
  isValidSafetensor,
  type ParsedSafetensorInfo,
} from "./safetensor-parser";

import {
  calculateFullHash,
  calculatePartialHash,
  validateModel,
  quickValidate,
} from "./hash-calculator";

import {
  detectArchitectureFromHeader,
  detectModelTypeFromPath,
  detectPrecision,
  type DetectionResult,
} from "./architecture-detector";

export interface ForensicsResult {
  filepath: string;
  filename: string;
  fileSize: number;
  
  // Hashes
  fullHash: string | null;
  partialHash: string | null;
  
  // Validation
  isValid: boolean;
  validationMessage?: string;
  
  // Detection
  detectedType: string;
  detectedArchitecture: string;
  detectedPrecision: string;
  detectionConfidence: "high" | "medium" | "low";
  
  // Embedded metadata
  embeddedMetadata: Record<string, string>;
  triggerWords: string[];
  
  // CivitAI (populated separately)
  civitaiModelId?: number;
  civitaiVersionId?: number;
  civitaiName?: string;
  civitaiBaseModel?: string;
}

/**
 * Perform forensic analysis on a model file
 */
export async function analyzeModel(
  filepath: string,
  options: {
    calculateFullHash?: boolean;
    calculatePartialHash?: boolean;
    skipValidation?: boolean;
  } = {}
): Promise<ForensicsResult | null> {
  const {
    calculateFullHash: doFullHash = false,
    calculatePartialHash: doPartialHash = true,
    skipValidation = false,
  } = options;

  if (!existsSync(filepath)) {
    return null;
  }

  const filename = path.basename(filepath);
  const fileSize = await getFileSize(filepath);
  const isSafetensor = filepath.toLowerCase().endsWith(".safetensors");

  let fullHash: string | null = null;
  let partialHash: string | null = null;
  let isValid = true;
  let validationMessage: string | undefined;
  let detectedType = detectModelTypeFromPath(filepath);
  let detectedArchitecture = "unknown";
  let detectionConfidence: "high" | "medium" | "low" = "low";
  let detectedPrecision = detectPrecision(filename);
  let embeddedMetadata: Record<string, string> = {};
  let triggerWords: string[] = [];

  // Hash calculation
  if (doFullHash) {
    fullHash = await calculateFullHash(filepath);
  }
  if (doPartialHash) {
    partialHash = await calculatePartialHash(filepath);
  }

  // Validation
  if (!skipValidation) {
    const validation = await quickValidate(filepath);
    isValid = validation.valid;
    validationMessage = validation.reason;
  }

  // Parse safetensor header for architecture detection
  if (isSafetensor && isValid) {
    const headerInfo = await readSafetensorHeader(filepath);
    
    if (headerInfo) {
      // Detect architecture
      const detection = detectArchitectureFromHeader(headerInfo.header, fileSize);
      detectedArchitecture = detection.architecture;
      detectionConfidence = detection.confidence;
      
      // If detection also gives model type, use it (but prefer path-based)
      if (detectedType === "unknown" && detection.modelType !== "unknown") {
        detectedType = detection.modelType;
      }
      
      // Extract embedded metadata
      const extracted = extractEmbeddedMetadata(headerInfo.header);
      embeddedMetadata = {
        ...extracted.trainingInfo,
        ...extracted.modelSpec,
      };
      triggerWords = extracted.triggerWords;
      
      // Update precision from metadata if available
      if (embeddedMetadata["modelspec.precision"]) {
        detectedPrecision = embeddedMetadata["modelspec.precision"];
      }
      
      // Update architecture from metadata if we got it
      if (extracted.baseModel && detectedArchitecture === "unknown") {
        detectedArchitecture = extracted.baseModel;
      }
    } else {
      // Couldn't parse header - might be corrupt
      isValid = false;
      validationMessage = "Failed to parse safetensor header - file may be corrupt";
    }
  }

  return {
    filepath,
    filename,
    fileSize,
    fullHash,
    partialHash,
    isValid,
    validationMessage,
    detectedType,
    detectedArchitecture,
    detectedPrecision,
    detectionConfidence,
    embeddedMetadata,
    triggerWords,
  };
}

/**
 * Quick scan of a model file - just get basic info without heavy analysis
 */
export async function quickScanModel(filepath: string): Promise<{
  filename: string;
  fileSize: number;
  detectedType: string;
  isValid: boolean;
} | null> {
  if (!existsSync(filepath)) {
    return null;
  }

  const filename = path.basename(filepath);
  const fileSize = await getFileSize(filepath);
  const detectedType = detectModelTypeFromPath(filepath);
  
  const validation = await quickValidate(filepath);

  return {
    filename,
    fileSize,
    detectedType,
    isValid: validation.valid,
  };
}

// Re-export components
export {
  readSafetensorHeader,
  extractEmbeddedMetadata,
  isValidSafetensor,
  getFileSize,
} from "./safetensor-parser";

export {
  calculateFullHash,
  calculatePartialHash,
  validateModel,
  quickValidate,
  standardValidate,
  fullValidate,
} from "./hash-calculator";

export {
  detectArchitectureFromHeader,
  detectModelTypeFromPath,
  detectPrecision,
} from "./architecture-detector";
