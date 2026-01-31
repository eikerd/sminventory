/**
 * Task formatting utilities
 */

/**
 * Format bytes to human-readable size
 */
export function formatBytes(bytes: number | null | undefined, decimals = 2): string {
  if (!bytes || bytes === 0) return "0 B";

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
}

/**
 * Format speed in bytes per second
 */
export function formatSpeed(bytesPerSec: number | null | undefined): string {
  if (!bytesPerSec || bytesPerSec === 0) return "0 B/s";

  const k = 1024;
  const sizes = ["B/s", "KB/s", "MB/s", "GB/s"];
  const i = Math.floor(Math.log(bytesPerSec) / Math.log(k));

  return parseFloat((bytesPerSec / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

/**
 * Format ETA in seconds to human-readable format
 */
export function formatEta(seconds: number | null | undefined): string {
  if (!seconds || seconds < 0) return "calculating...";

  if (seconds < 60) return `${Math.round(seconds)}s`;

  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);

  if (mins < 60) return `${mins}m ${secs}s`;

  const hours = Math.floor(mins / 60);
  const remainingMins = mins % 60;

  return `${hours}h ${remainingMins}m`;
}

/**
 * Calculate ETA based on current progress
 */
export function calculateEta(
  currentBytes: number | null | undefined,
  totalBytes: number | null | undefined,
  speed: number | null | undefined
): number | null {
  if (!currentBytes || !totalBytes || !speed || speed === 0) return null;

  const remainingBytes = totalBytes - currentBytes;
  if (remainingBytes <= 0) return 0;

  return remainingBytes / speed;
}

/**
 * Calculate progress percentage
 */
export function calculateProgress(
  current: number | null | undefined,
  total: number | null | undefined
): number {
  if (!total || total === 0) return 0;
  if (!current) return 0;

  return Math.min(100, Math.max(0, Math.round((current / total) * 100)));
}
