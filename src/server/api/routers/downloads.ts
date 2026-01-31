import { router, publicProcedure } from "@/server/api/trpc";
import { db } from "@/server/db";
import { downloadQueue, workflowDependencies } from "@/server/db/schema";
import { taskManager } from "@/server/services/task-manager";
import { downloadWorker } from "@/server/services/workers/download-worker";
import { CONFIG, TASK_TYPE } from "@/lib/config";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import * as path from "path";

// Register download worker
taskManager.registerWorker(TASK_TYPE.DOWNLOAD, downloadWorker);

export const downloadsRouter = router({
  /**
   * Queue a download from a workflow dependency
   */
  queueFromDependency: publicProcedure
    .input(
      z.object({
        dependencyId: z.number(),
        workflowId: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const dep = await db.query.workflowDependencies.findFirst({
        where: eq(workflowDependencies.id, input.dependencyId),
      });

      if (!dep) {
        throw new Error("Dependency not found");
      }

      if (!dep.civitaiUrl && !dep.huggingfaceUrl) {
        throw new Error("No download URL available for this dependency");
      }

      const url = dep.civitaiUrl || dep.huggingfaceUrl;
      if (!url) throw new Error("No valid URL");

      // Determine destination path
      const modelDir = CONFIG.paths.models;
      const modelTypeDir = CONFIG.modelTypeMap[dep.modelType as keyof typeof CONFIG.modelTypeMap]?.[0] || "checkpoints";
      const destinationPath = path.join(modelDir, modelTypeDir, dep.modelName);

      // Create download queue entry
      const downloadItem = await db
        .insert(downloadQueue)
        .values({
          dependencyId: dep.id,
          workflowId: input.workflowId,
          modelName: dep.modelName,
          modelType: dep.modelType,
          source: url.includes("civitai") ? "civitai" : "huggingface",
          url,
          destinationPath,
          expectedSize: dep.estimatedSize,
          status: "queued",
        })
        .returning();

      if (!downloadItem[0]) {
        throw new Error("Failed to create download queue entry");
      }

      // Create task for this download
      const task = await taskManager.createTask(
        TASK_TYPE.DOWNLOAD,
        String(downloadItem[0].id),
        {
          name: `Download ${dep.modelName}`,
          description: `Downloading ${dep.modelType} from ${downloadItem[0].source}`,
          totalBytes: dep.estimatedSize || 0,
          cancellable: true,
          pausable: true,
        }
      );

      return {
        taskId: task.id,
        downloadId: downloadItem[0].id,
      };
    }),

  /**
   * Queue a download from a URL
   */
  queueFromUrl: publicProcedure
    .input(
      z.object({
        url: z.string().url(),
        filename: z.string(),
        modelType: z.string(),
      })
    )
    .mutation(async ({ input }) => {
      const destinationPath = path.join(
        CONFIG.paths.models,
        "checkpoints",
        input.filename
      );

      const downloadItem = await db
        .insert(downloadQueue)
        .values({
          modelName: input.filename,
          modelType: input.modelType,
          source: "direct",
          url: input.url,
          destinationPath,
          status: "queued",
        })
        .returning();

      if (!downloadItem[0]) {
        throw new Error("Failed to create download queue entry");
      }

      const task = await taskManager.createTask(
        TASK_TYPE.DOWNLOAD,
        String(downloadItem[0].id),
        {
          name: `Download ${input.filename}`,
          description: `Downloading from URL`,
          cancellable: true,
          pausable: true,
        }
      );

      return {
        taskId: task.id,
        downloadId: downloadItem[0].id,
      };
    }),

  /**
   * List downloads with task information
   */
  list: publicProcedure
    .input(
      z.object({
        status: z.string().optional(),
        limit: z.number().default(50),
        offset: z.number().default(0),
      })
    )
    .query(async ({ input }) => {
      // Get download queue items
      let query = db.query.downloadQueue.findMany({
        limit: input.limit,
        offset: input.offset,
      });

      const items = await query;

      // Enrich with task data
      const enriched = await Promise.all(
        items.map(async (item) => {
          let taskData = null;
          if (item.taskId) {
            const result = await taskManager.getTask(item.taskId);
            taskData = result?.task;
          }
          return {
            ...item,
            task: taskData,
          };
        })
      );

      return enriched;
    }),

  /**
   * Get a single download with full details
   */
  get: publicProcedure
    .input(z.object({ downloadId: z.number() }))
    .query(async ({ input }) => {
      const item = await db.query.downloadQueue.findFirst({
        where: eq(downloadQueue.id, input.downloadId),
      });

      if (!item) {
        return null;
      }

      let taskData = null;
      let logs: any[] = [];
      if (item.taskId) {
        const result = await taskManager.getTask(item.taskId);
        taskData = result?.task;
        logs = result?.logs || [];
      }

      return {
        ...item,
        task: taskData,
        logs,
      };
    }),

  /**
   * Cancel a download
   */
  cancel: publicProcedure
    .input(z.object({ downloadId: z.number() }))
    .mutation(async ({ input }) => {
      const item = await db.query.downloadQueue.findFirst({
        where: eq(downloadQueue.id, input.downloadId),
      });

      if (!item) {
        throw new Error("Download not found");
      }

      if (item.taskId) {
        await taskManager.cancelTask(item.taskId);
      }

      await db
        .update(downloadQueue)
        .set({ status: "cancelled" })
        .where(eq(downloadQueue.id, input.downloadId));

      return { success: true };
    }),

  /**
   * Retry a failed download
   */
  retry: publicProcedure
    .input(z.object({ downloadId: z.number() }))
    .mutation(async ({ input }) => {
      const item = await db.query.downloadQueue.findFirst({
        where: eq(downloadQueue.id, input.downloadId),
      });

      if (!item) {
        throw new Error("Download not found");
      }

      if (item.taskId) {
        await taskManager.retryTask(item.taskId);
      }

      await db
        .update(downloadQueue)
        .set({ status: "queued", errorMessage: null })
        .where(eq(downloadQueue.id, input.downloadId));

      return { success: true };
    }),
});
