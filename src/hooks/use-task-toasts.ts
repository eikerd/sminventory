import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

export function useTaskToasts() {
  const previousTasksRef = useRef<Map<string, string>>(new Map());
  const shownToastsRef = useRef<Set<string>>(new Set());

  // Fetch all tasks
  const { data } = trpc.tasks.list.useQuery(
    { limit: 100 },
    {
      refetchInterval: 1000,
      staleTime: 0,
    }
  );

  // data is the array directly, not an object with tasks property
  const tasks = Array.isArray(data) ? data : [];

  useEffect(() => {
    tasks.forEach((task) => {
      const previousStatus = previousTasksRef.current.get(task.id);
      const toastId = `task-${task.id}`;

      // Only show toast if status changed
      if (previousStatus !== task.status) {
        switch (task.status) {
          case "completed":
            toast.success(`✅ ${task.name || task.id} completed`, {
              id: toastId,
              description: task.description || "Task finished successfully",
              action: {
                label: "View",
                onClick: () => {
                  window.location.href = `/downloads`;
                },
              },
              duration: 5000,
            });
            shownToastsRef.current.add(toastId);
            break;

          case "failed":
            toast.error(`❌ ${task.name || task.id} failed`, {
              id: toastId,
              description: task.errorMessage || "An error occurred during task execution",
              action: {
                label: "Retry",
                onClick: async () => {
                  shownToastsRef.current.delete(toastId);
                  toast.loading(`Retrying ${task.name}...`, { id: toastId });
                },
              },
              duration: 6000,
            });
            shownToastsRef.current.add(toastId);
            break;

          case "cancelled":
            toast.info(`⏹️ ${task.name || task.id} cancelled`, {
              id: toastId,
              description: "Task was cancelled",
              duration: 3000,
            });
            break;

          case "paused":
            toast.info(`⏸️ ${task.name || task.id} paused`, {
              id: toastId,
              description: "Task is paused. Click to resume.",
              duration: 3000,
            });
            break;
        }

        previousTasksRef.current.set(task.id, task.status);
      }
    });
  }, [tasks]);

  return tasks;
}
