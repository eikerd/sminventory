import * as fs from "fs";
import * as path from "path";
import { createWriteStream, createReadStream } from "fs";
import { pipeline } from "stream/promises";
import { createHash } from "crypto";

export interface DownloadOptions {
  url: string;
  destinationPath: string;
  expectedHash?: string;
  onProgress?: (bytesDownloaded: number, totalBytes: number, speed: number) => void;
  signal?: AbortSignal;
}

export interface DownloadResult {
  success: boolean;
  filepath: string;
  bytesDownloaded: number;
  sha256?: string;
  error?: string;
}

/**
 * DownloadManager - Handles HTTP downloads with resume capability
 */
export class DownloadManager {
  private static instance: DownloadManager;

  private constructor() {}

  static getInstance(): DownloadManager {
    if (!DownloadManager.instance) {
      DownloadManager.instance = new DownloadManager();
    }
    return DownloadManager.instance;
  }

  /**
   * Download a file with resume support and progress tracking
   */
  async download(options: DownloadOptions): Promise<DownloadResult> {
    const {
      url,
      destinationPath,
      expectedHash,
      onProgress,
      signal,
    } = options;

    // Create directory if it doesn't exist
    const dir = path.dirname(destinationPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const tempPath = `${destinationPath}.part`;
    let bytesDownloaded = 0;
    let totalBytes = 0;
    let lastProgressTime = Date.now();
    let lastProgressBytes = 0;

    try {
      // Check if we have a partial download
      if (fs.existsSync(tempPath)) {
        const stats = fs.statSync(tempPath);
        bytesDownloaded = stats.size;
      }

      // Fetch with range header for resume
      const headers: Record<string, string> = {};
      if (bytesDownloaded > 0) {
        headers["Range"] = `bytes=${bytesDownloaded}-`;
      }

      const response = await fetch(url, { headers, signal });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // Get total file size
      const contentLength = response.headers.get("content-length");
      const contentRange = response.headers.get("content-range");

      if (contentRange) {
        // Parse "bytes 1000-2000/5000" format
        const match = contentRange.match(/\/(\d+)$/);
        totalBytes = match ? parseInt(match[1], 10) : bytesDownloaded;
      } else if (contentLength) {
        totalBytes = bytesDownloaded + parseInt(contentLength, 10);
      } else {
        totalBytes = 0;
      }

      // Stream download to temp file
      const writeStream = createWriteStream(tempPath, {
        flags: bytesDownloaded > 0 ? "a" : "w",
      });

      if (!response.body) {
        throw new Error("No response body");
      }

      const reader = response.body.getReader();
      const hash = expectedHash ? createHash("sha256") : null;

      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        if (signal?.aborted) {
          reader.cancel();
          throw new Error("Download aborted");
        }

        bytesDownloaded += value.length;

        // Calculate speed
        const now = Date.now();
        const timeDelta = (now - lastProgressTime) / 1000;
        if (timeDelta > 0.5) {
          // Update every 500ms
          const bytesDelta = bytesDownloaded - lastProgressBytes;
          const speed = bytesDelta / timeDelta;
          onProgress?.(bytesDownloaded, totalBytes, speed);
          lastProgressTime = now;
          lastProgressBytes = bytesDownloaded;
        }

        writeStream.write(value);
        if (hash) hash.update(value);
      }

      await new Promise<void>((resolve, reject) => {
        writeStream.end(() => {
          resolve();
        });
        writeStream.on("error", reject);
      });

      // Validate hash if provided
      if (hash && expectedHash) {
        const calculatedHash = hash.digest("hex");
        if (calculatedHash !== expectedHash) {
          fs.unlinkSync(tempPath);
          throw new Error(
            `Hash mismatch: expected ${expectedHash}, got ${calculatedHash}`
          );
        }
      }

      // Atomic rename
      if (fs.existsSync(destinationPath)) {
        fs.unlinkSync(destinationPath);
      }
      fs.renameSync(tempPath, destinationPath);

      return {
        success: true,
        filepath: destinationPath,
        bytesDownloaded,
        sha256: hash?.digest("hex"),
      };
    } catch (error) {
      // Clean up temp file on error
      if (fs.existsSync(tempPath)) {
        try {
          fs.unlinkSync(tempPath);
        } catch {
          // Ignore cleanup errors
        }
      }

      const message = error instanceof Error ? error.message : String(error);
      return {
        success: false,
        filepath: destinationPath,
        bytesDownloaded,
        error: message,
      };
    }
  }

  /**
   * Calculate SHA256 hash of existing file
   */
  async hashFile(filepath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const hash = createHash("sha256");
      const stream = createReadStream(filepath);

      stream.on("data", (data) => hash.update(data));
      stream.on("end", () => resolve(hash.digest("hex")));
      stream.on("error", reject);
    });
  }

  /**
   * Check if URL is reachable and get file info
   */
  async getFileInfo(url: string): Promise<{
    size: number;
    resumable: boolean;
    contentType?: string;
  }> {
    try {
      const response = await fetch(url, { method: "HEAD" });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const size = parseInt(response.headers.get("content-length") || "0", 10);
      const acceptRanges = response.headers.get("accept-ranges");
      const contentType = response.headers.get("content-type");

      return {
        size,
        resumable: acceptRanges === "bytes",
        contentType: contentType || undefined,
      };
    } catch (error) {
      throw new Error(
        `Failed to get file info: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}

export const downloadManager = DownloadManager.getInstance();
