import { db } from "@/server/db";
import { tasks, taskLogs, NewTask, Task, NewTaskLog } from "@/server/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { TASK_STATUS } from "@/lib/config";

type TaskWorkerFunction = (
  task: Task,
  updateProgress: (progress: Partial<Task>) => Promise<void>,
  addLog: (level: string, message: string, metadata?: Record<string, unknown>) => Promise<void>
) => Promise<void>;

export interface TaskOptions {
  name: string;
  description?: string;
  priority?: number;
  totalBytes?: number;
  totalItems?: number;
  maxRetries?: number;
  cancellable?: boolean;
  pausable?: boolean;
}

/**
 * TaskManager - Singleton service for managing background tasks
 * Handles task lifecycle, persistence, progress tracking, and worker execution
 */
class TaskManager {
  private static instance: TaskManager;
  private workerMap = new Map<string, TaskWorkerFunction>();
  private activeWorkers = new Map<string, AbortController>();
  private maxConcurrent = 3;

  private constructor() {}

  static getInstance(): TaskManager {
    if (!TaskManager.instance) {
      TaskManager.instance = new TaskManager();
    }
    return TaskManager.instance;
  }

  /**
   * Register a task type worker
   */
  registerWorker(taskType: string, worker: TaskWorkerFunction) {
    this.workerMap.set(taskType, worker);
  }

  /**
   * Create a new task
   */
  async createTask(
    taskType: string,
    relatedId: string | null,
    options: TaskOptions
  ): Promise<Task> {
    const id = uuidv4();

    const newTask: NewTask = {
      id,
      taskType,
      relatedId,
      name: options.name,
      description: options.description,
      status: TASK_STATUS.PENDING,
      priority: options.priority ?? 0,
      totalBytes: options.totalBytes,
      totalItems: options.totalItems,
      maxRetries: options.maxRetries ?? 3,
      cancellable: options.cancellable ? 1 : 0,
      pausable: options.pausable ? 1 : 0,
    };

    await db.insert(tasks).values(newTask);
    const created = await db.query.tasks.findFirst({
      where: eq(tasks.id, id),
    });

    if (!created) throw new Error("Failed to create task");

    // Start processing this task asynchronously
    this.processTaskAsync(created);

    return created;
  }

  /**
   * Get a single task with its logs
   */
  async getTask(taskId: string) {
    const task = await db.query.tasks.findFirst({
      where: eq(tasks.id, taskId),
    });

    if (!task) return null;

    const logs = await db.query.taskLogs.findMany({
      where: eq(taskLogs.taskId, taskId),
    });

    return { task, logs };
  }

  /**
   * List tasks with filtering
   */
  async listTasks(filters?: {
    status?: string;
    taskType?: string;
    limit?: number;
    offset?: number;
  }) {
    const conditions = [];

    if (filters?.status) {
      conditions.push(eq(tasks.status, filters.status));
    }

    if (filters?.taskType) {
      conditions.push(eq(tasks.taskType, filters.taskType));
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const taskList = await db.query.tasks.findMany({
      where,
      orderBy: [desc(tasks.createdAt)],
      limit: filters?.limit,
      offset: filters?.offset,
    });

    return taskList;
  }

  /**
   * Get task statistics
   */
  async getStats() {
    const allTasks = await db.query.tasks.findMany();

    return {
      total: allTasks.length,
      active: allTasks.filter((t) => t.status === TASK_STATUS.RUNNING).length,
      queued: allTasks.filter((t) => t.status === TASK_STATUS.PENDING).length,
      completed: allTasks.filter((t) => t.status === TASK_STATUS.COMPLETED).length,
      failed: allTasks.filter((t) => t.status === TASK_STATUS.FAILED).length,
      paused: allTasks.filter((t) => t.status === TASK_STATUS.PAUSED).length,
    };
  }

  /**
   * Pause a task
   */
  async pauseTask(taskId: string): Promise<void> {
    const task = await db.query.tasks.findFirst({
      where: eq(tasks.id, taskId),
    });

    if (!task || !task.pausable) {
      throw new Error("Task cannot be paused");
    }

    await db
      .update(tasks)
      .set({
        status: TASK_STATUS.PAUSED,
        pausedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(tasks.id, taskId));

    // Abort worker if running
    const controller = this.activeWorkers.get(taskId);
    if (controller) {
      controller.abort();
    }
  }

  /**
   * Resume a paused task
   */
  async resumeTask(taskId: string): Promise<void> {
    const task = await db.query.tasks.findFirst({
      where: eq(tasks.id, taskId),
    });

    if (!task) {
      throw new Error("Task not found");
    }

    await db
      .update(tasks)
      .set({
        status: TASK_STATUS.RUNNING,
        pausedAt: null,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(tasks.id, taskId));

    this.processTaskAsync(task);
  }

  /**
   * Cancel a task
   */
  async cancelTask(taskId: string): Promise<void> {
    const task = await db.query.tasks.findFirst({
      where: eq(tasks.id, taskId),
    });

    if (!task || !task.cancellable) {
      throw new Error("Task cannot be cancelled");
    }

    await db
      .update(tasks)
      .set({
        status: TASK_STATUS.CANCELLED,
        completedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      .where(eq(tasks.id, taskId));

    // Abort worker if running
    const controller = this.activeWorkers.get(taskId);
    if (controller) {
      controller.abort();
    }
  }

  /**
   * Retry a failed task
   */
  async retryTask(taskId: string): Promise<void> {
    const task = await db.query.tasks.findFirst({
      where: eq(tasks.id, taskId),
    });

    if (!task) {
      throw new Error("Task not found");
    }

    const currentRetries = task.retryCount ?? 0;
    const maxRetries = task.maxRetries ?? 3;

    if (currentRetries >= maxRetries) {
      throw new Error("Max retries exceeded");
    }

    await db
      .update(tasks)
      .set({
        status: TASK_STATUS.PENDING,
        retryCount: currentRetries + 1,
        errorMessage: null,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(tasks.id, taskId));

    this.processTaskAsync(task);
  }

  /**
   * Pause all active tasks
   */
  async pauseAll(): Promise<void> {
    const activeTasks = await db.query.tasks.findMany({
      where: eq(tasks.status, TASK_STATUS.RUNNING),
    });

    for (const task of activeTasks) {
      if (task.pausable) {
        await this.pauseTask(task.id);
      }
    }
  }

  /**
   * Resume all paused tasks
   */
  async resumeAll(): Promise<void> {
    const pausedTasks = await db.query.tasks.findMany({
      where: eq(tasks.status, TASK_STATUS.PAUSED),
    });

    for (const task of pausedTasks) {
      await this.resumeTask(task.id);
    }
  }

  /**
   * Cancel all active and pending tasks
   */
  async cancelAll(): Promise<void> {
    const activeTasks = await db.query.tasks.findMany({
      where: eq(tasks.status, TASK_STATUS.RUNNING),
    });

    const pendingTasks = await db.query.tasks.findMany({
      where: eq(tasks.status, TASK_STATUS.PENDING),
    });

    for (const task of [...activeTasks, ...pendingTasks]) {
      if (task.cancellable) {
        await this.cancelTask(task.id);
      }
    }
  }

  /**
   * Clear completed tasks
   */
  async clearCompleted(): Promise<void> {
    await db.delete(tasks).where(eq(tasks.status, TASK_STATUS.COMPLETED));
  }

  /**
   * Add a log entry to a task
   */
  async addTaskLog(
    taskId: string,
    level: string,
    message: string,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    const newLog: NewTaskLog = {
      taskId,
      level,
      message,
      metadata: metadata ? JSON.stringify(metadata) : null,
    };

    await db.insert(taskLogs).values(newLog);
  }

  /**
   * Get task logs with pagination
   */
  async getTaskLogs(taskId: string, limit = 100, offset = 0) {
    return db.query.taskLogs.findMany({
      where: eq(taskLogs.taskId, taskId),
      orderBy: [desc(taskLogs.timestamp)],
      limit,
      offset,
    });
  }

  /**
   * Private: Process a task asynchronously
   */
  private async processTaskAsync(task: Task): Promise<void> {
    // Check if we're at max concurrent tasks
    if (this.activeWorkers.size >= this.maxConcurrent) {
      // Queue will be processed when a worker finishes
      return;
    }

    const worker = this.workerMap.get(task.taskType);
    if (!worker) {
      await this.addTaskLog(
        task.id,
        "error",
        `No worker registered for task type: ${task.taskType}`
      );
      await db
        .update(tasks)
        .set({
          status: TASK_STATUS.FAILED,
          errorMessage: `No worker registered for task type: ${task.taskType}`,
          completedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
        .where(eq(tasks.id, task.id));
      return;
    }

    // Create abort controller
    const controller = new AbortController();
    this.activeWorkers.set(task.id, controller);

    try {
      // Mark as running
      await db
        .update(tasks)
        .set({
          status: TASK_STATUS.RUNNING,
          startedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
        .where(eq(tasks.id, task.id));

      // Run worker
      const updateProgress = async (progress: Partial<Task>) => {
        if (controller.signal.aborted) throw new Error("Task aborted");

        await db
          .update(tasks)
          .set({
            ...progress,
            updatedAt: new Date().toISOString(),
          })
          .where(eq(tasks.id, task.id));
      };

      const addLog = async (
        level: string,
        message: string,
        metadata?: Record<string, unknown>
      ) => {
        await this.addTaskLog(task.id, level, message, metadata);
      };

      await worker(task, updateProgress, addLog);

      // Mark as completed if not already failed/cancelled
      const current = await db.query.tasks.findFirst({
        where: eq(tasks.id, task.id),
      });

      if (
        current &&
        current.status !== TASK_STATUS.FAILED &&
        current.status !== TASK_STATUS.CANCELLED
      ) {
        await db
          .update(tasks)
          .set({
            status: TASK_STATUS.COMPLETED,
            completedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          })
          .where(eq(tasks.id, task.id));
      }

      await this.addTaskLog(task.id, "info", "Task completed successfully");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";

      if (message !== "Task aborted") {
        await db
          .update(tasks)
          .set({
            status: TASK_STATUS.FAILED,
            errorMessage: message,
            completedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          })
          .where(eq(tasks.id, task.id));

        await this.addTaskLog(task.id, "error", `Task failed: ${message}`);
      }
    } finally {
      // Clean up worker
      this.activeWorkers.delete(task.id);

      // Process next queued task
      const nextTask = await db.query.tasks.findFirst({
        where: eq(tasks.status, TASK_STATUS.PENDING),
        orderBy: [desc(tasks.priority), desc(tasks.createdAt)],
      });

      if (nextTask) {
        this.processTaskAsync(nextTask);
      }
    }
  }
}

export const taskManager = TaskManager.getInstance();
