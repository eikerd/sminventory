import fs from "fs/promises";
import { createReadStream, existsSync } from "fs";
import crypto from "crypto";

const CHUNK_SIZE = 10 * 1024 * 1024; // 10MB chunks for partial hash

/**
 * Calculate full SHA256 hash of a file
 * Use this for complete verification
 */
export async function calculateFullHash(filepath: string): Promise<string | null> {
  if (!existsSync(filepath)) {
    return null;
  }

  return new Promise((resolve, reject) => {
    const hash = crypto.createHash("sha256");
    const stream = createReadStream(filepath);

    stream.on("data", (data) => hash.update(data));
    stream.on("end", () => resolve(hash.digest("hex").toUpperCase()));
    stream.on("error", reject);
  });
}

/**
 * Calculate partial hash for quick validation
 * Hashes: first 10MB + last 10MB + file size
 * This is fast and catches most corruption/incomplete downloads
 */
export async function calculatePartialHash(filepath: string): Promise<string | null> {
  if (!existsSync(filepath)) {
    return null;
  }

  try {
    const stats = await fs.stat(filepath);
    const fileSize = stats.size;
    const hash = crypto.createHash("sha256");

    const fileHandle = await fs.open(filepath, "r");

    try {
      // Read first chunk
      const firstChunkSize = Math.min(CHUNK_SIZE, fileSize);
      const firstChunk = Buffer.alloc(firstChunkSize);
      await fileHandle.read(firstChunk, 0, firstChunkSize, 0);
      hash.update(firstChunk);

      // Read last chunk if file is large enough
      if (fileSize > CHUNK_SIZE * 2) {
        const lastChunk = Buffer.alloc(CHUNK_SIZE);
        await fileHandle.read(lastChunk, 0, CHUNK_SIZE, fileSize - CHUNK_SIZE);
        hash.update(lastChunk);
      } else if (fileSize > CHUNK_SIZE) {
        // File is between 10MB and 20MB, read remaining bytes
        const remainingSize = fileSize - CHUNK_SIZE;
        const lastChunk = Buffer.alloc(remainingSize);
        await fileHandle.read(lastChunk, 0, remainingSize, CHUNK_SIZE);
        hash.update(lastChunk);
      }

      // Include file size in hash for uniqueness
      hash.update(fileSize.toString());

      return hash.digest("hex").toUpperCase();
    } finally {
      await fileHandle.close();
    }
  } catch (error) {
    console.error(`Failed to calculate partial hash for ${filepath}:`, error);
    return null;
  }
}

/**
 * Quick validation - just check file exists and has expected size
 */
export async function quickValidate(
  filepath: string,
  expectedSize?: number
): Promise<{ valid: boolean; actualSize: number; reason?: string }> {
  if (!existsSync(filepath)) {
    return { valid: false, actualSize: 0, reason: "File not found" };
  }

  try {
    const stats = await fs.stat(filepath);
    const actualSize = stats.size;

    if (expectedSize !== undefined && actualSize !== expectedSize) {
      return {
        valid: false,
        actualSize,
        reason: `Size mismatch: expected ${expectedSize}, got ${actualSize}`,
      };
    }

    // Check if file is suspiciously small (likely incomplete)
    if (actualSize < 1024) {
      return {
        valid: false,
        actualSize,
        reason: "File too small - likely incomplete download",
      };
    }

    return { valid: true, actualSize };
  } catch (error) {
    return { valid: false, actualSize: 0, reason: String(error) };
  }
}

/**
 * Standard validation - partial hash comparison
 */
export async function standardValidate(
  filepath: string,
  expectedHash?: string
): Promise<{ valid: boolean; hash: string | null; reason?: string }> {
  const hash = await calculatePartialHash(filepath);

  if (!hash) {
    return { valid: false, hash: null, reason: "Failed to calculate hash" };
  }

  if (expectedHash && hash !== expectedHash.toUpperCase()) {
    return {
      valid: false,
      hash,
      reason: `Hash mismatch: expected ${expectedHash}, got ${hash}`,
    };
  }

  return { valid: true, hash };
}

/**
 * Full validation - complete SHA256 hash comparison
 */
export async function fullValidate(
  filepath: string,
  expectedHash?: string
): Promise<{ valid: boolean; hash: string | null; reason?: string }> {
  const hash = await calculateFullHash(filepath);

  if (!hash) {
    return { valid: false, hash: null, reason: "Failed to calculate hash" };
  }

  if (expectedHash && hash !== expectedHash.toUpperCase()) {
    return {
      valid: false,
      hash,
      reason: `Hash mismatch: expected ${expectedHash}, got ${hash}`,
    };
  }

  return { valid: true, hash };
}

/**
 * Validate a model file with specified level
 */
export async function validateModel(
  filepath: string,
  level: "quick" | "standard" | "full",
  expectedHash?: string,
  expectedSize?: number
): Promise<{
  valid: boolean;
  hash?: string | null;
  size?: number;
  reason?: string;
}> {
  switch (level) {
    case "quick":
      const quickResult = await quickValidate(filepath, expectedSize);
      return {
        valid: quickResult.valid,
        size: quickResult.actualSize,
        reason: quickResult.reason,
      };

    case "standard":
      const stdResult = await standardValidate(filepath, expectedHash);
      const stdSize = await fs.stat(filepath).then((s) => s.size).catch(() => 0);
      return {
        valid: stdResult.valid,
        hash: stdResult.hash,
        size: stdSize,
        reason: stdResult.reason,
      };

    case "full":
      const fullResult = await fullValidate(filepath, expectedHash);
      const fullSize = await fs.stat(filepath).then((s) => s.size).catch(() => 0);
      return {
        valid: fullResult.valid,
        hash: fullResult.hash,
        size: fullSize,
        reason: fullResult.reason,
      };
  }
}
