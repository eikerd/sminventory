import { router, publicProcedure } from "@/server/api/trpc";
import { taskManager } from "@/server/services/task-manager";
import { z } from "zod";

export const tasksRouter = router({
  /**
   * List tasks with optional filtering
   */
  list: publicProcedure
    .input(
      z.object({
        status: z.string().optional(),
        taskType: z.string().optional(),
        limit: z.number().int().positive().default(50),
        offset: z.number().int().nonnegative().default(0),
      })
    )
    .query(async ({ input }) => {
      return taskManager.listTasks({
        status: input.status,
        taskType: input.taskType,
        limit: input.limit,
        offset: input.offset,
      });
    }),

  /**
   * Get a single task with its logs
   */
  get: publicProcedure
    .input(z.object({ taskId: z.string() }))
    .query(async ({ input }) => {
      return taskManager.getTask(input.taskId);
    }),

  /**
   * Get task statistics
   */
  stats: publicProcedure.query(async () => {
    return taskManager.getStats();
  }),

  /**
   * Get task logs
   */
  getLogs: publicProcedure
    .input(
      z.object({
        taskId: z.string(),
        limit: z.number().int().positive().default(100),
        offset: z.number().int().nonnegative().default(0),
      })
    )
    .query(async ({ input }) => {
      return taskManager.getTaskLogs(input.taskId, input.limit, input.offset);
    }),

  /**
   * Pause a task
   */
  pause: publicProcedure
    .input(z.object({ taskId: z.string() }))
    .mutation(async ({ input }) => {
      await taskManager.pauseTask(input.taskId);
      return { success: true };
    }),

  /**
   * Resume a paused task
   */
  resume: publicProcedure
    .input(z.object({ taskId: z.string() }))
    .mutation(async ({ input }) => {
      await taskManager.resumeTask(input.taskId);
      return { success: true };
    }),

  /**
   * Cancel a task
   */
  cancel: publicProcedure
    .input(z.object({ taskId: z.string() }))
    .mutation(async ({ input }) => {
      await taskManager.cancelTask(input.taskId);
      return { success: true };
    }),

  /**
   * Retry a failed task
   */
  retry: publicProcedure
    .input(z.object({ taskId: z.string() }))
    .mutation(async ({ input }) => {
      await taskManager.retryTask(input.taskId);
      return { success: true };
    }),

  /**
   * Pause all running tasks
   */
  pauseAll: publicProcedure.mutation(async () => {
    await taskManager.pauseAll();
    return { success: true };
  }),

  /**
   * Resume all paused tasks
   */
  resumeAll: publicProcedure.mutation(async () => {
    await taskManager.resumeAll();
    return { success: true };
  }),

  /**
   * Cancel all active and pending tasks
   */
  cancelAll: publicProcedure.mutation(async () => {
    await taskManager.cancelAll();
    return { success: true };
  }),

  /**
   * Clear all completed tasks
   */
  clearCompleted: publicProcedure.mutation(async () => {
    await taskManager.clearCompleted();
    return { success: true };
  }),
});
