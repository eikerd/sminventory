import { Task } from "@/server/db/schema";
import { downloadManager } from "@/server/services/download-manager";
import { db } from "@/server/db";
import { downloadQueue } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { calculateEta } from "@/lib/task-utils";

/**
 * Download worker - Handles file downloads with progress tracking
 */
export const downloadWorker = async (
  task: Task,
  updateProgress: (progress: Partial<Task>) => Promise<void>,
  addLog: (level: string, message: string, metadata?: Record<string, unknown>) => Promise<void>
) => {
  // Get the download queue item
  const downloadItem = await db.query.downloadQueue.findFirst({
    where: eq(downloadQueue.id, parseInt(task.relatedId || "0")),
  });

  if (!downloadItem) {
    throw new Error("Download queue item not found");
  }

  await addLog(
    "info",
    `Starting download: ${downloadItem.modelName}`,
    {
      url: downloadItem.url,
      destination: downloadItem.destinationPath,
      expectedSize: downloadItem.expectedSize,
    }
  );

  // Create abort signal for cancellation
  const controller = new AbortController();

  try {
    // Download with progress tracking
    const result = await downloadManager.download({
      url: downloadItem.url,
      destinationPath: downloadItem.destinationPath,
      expectedHash: downloadItem.expectedHash || undefined,
      signal: controller.signal,
      onProgress: async (bytesDownloaded, totalBytes, speed) => {
        const progress = totalBytes > 0 ? Math.round((bytesDownloaded / totalBytes) * 100) : 0;
        const eta = calculateEta(bytesDownloaded, totalBytes, speed);

        await updateProgress({
          progress,
          currentBytes: bytesDownloaded,
          totalBytes,
          speed: Math.round(speed),
          eta: eta ? Math.round(eta) : undefined,
        });

        // Update download queue item
        await db
          .update(downloadQueue)
          .set({
            progress,
            downloadedBytes: bytesDownloaded,
            status: "downloading",
          })
          .where(eq(downloadQueue.id, downloadItem.id));
      },
    });

    if (!result.success) {
      throw new Error(result.error || "Download failed");
    }

    // Mark as validating
    await updateProgress({
      status: "validating",
    });

    await addLog("info", "Download completed, validating file...", {
      sha256: result.sha256,
      filepath: result.filepath,
    });

    // Update download queue with completion
    await db
      .update(downloadQueue)
      .set({
        status: "complete",
        progress: 100,
        completedAt: new Date().toISOString(),
      })
      .where(eq(downloadQueue.id, downloadItem.id));

    await addLog(
      "info",
      `Download validated successfully: ${downloadItem.modelName}`,
      {
        filesize: result.bytesDownloaded,
        sha256: result.sha256,
      }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    await addLog("error", `Download failed: ${message}`);

    // Update download queue with failure
    await db
      .update(downloadQueue)
      .set({
        status: "failed",
        errorMessage: message,
      })
      .where(eq(downloadQueue.id, downloadItem.id));

    throw error;
  }
};
