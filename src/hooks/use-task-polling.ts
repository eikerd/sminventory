"use client";

import { useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { TASK_STATUS } from "@/lib/config";

interface UseTaskPollingOptions {
  taskId?: string;
  enabled?: boolean;
  interval?: number;
}

/**
 * Poll a task for updates
 * Automatically stops polling when task completes
 */
export function useTaskPolling(options: UseTaskPollingOptions = {}) {
  const { taskId, enabled = true, interval = 500 } = options;

  const taskQuery = trpc.tasks.get.useQuery(
    { taskId: taskId || "" },
    {
      enabled: enabled && !!taskId,
      refetchInterval:
        enabled && taskId && interval > 0 ? interval : false,
      refetchOnWindowFocus: false,
    }
  );

  // Stop polling when task is completed
  const isComplete =
    taskQuery.data?.task?.status === TASK_STATUS.COMPLETED ||
    taskQuery.data?.task?.status === TASK_STATUS.FAILED ||
    taskQuery.data?.task?.status === TASK_STATUS.CANCELLED;

  return {
    task: taskQuery.data?.task || null,
    logs: taskQuery.data?.logs || [],
    isLoading: taskQuery.isLoading,
    isPolling:
      enabled && !!taskId && !isComplete,
  };
}
