"use client";

import { Task, TaskLog } from "@/server/db/schema";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TaskProgress } from "@/components/ui/task-progress";
import { trpc } from "@/lib/trpc";
import {
  Pause,
  Play,
  RotateCcw,
  X,
  FolderOpen,
} from "lucide-react";
import { toast } from "sonner";

interface TaskDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: Task | null;
  logs: TaskLog[];
}

export function TaskDetailModal({
  open,
  onOpenChange,
  task,
  logs,
}: TaskDetailModalProps) {
  const pauseMutation = trpc.tasks.pause.useMutation();
  const resumeMutation = trpc.tasks.resume.useMutation();
  const cancelMutation = trpc.tasks.cancel.useMutation();
  const retryMutation = trpc.tasks.retry.useMutation();

  const handleAction = async (action: () => Promise<any>, label: string) => {
    try {
      await action();
      toast.success(`Task ${label}d`);
    } catch (error) {
      toast.error(`Failed to ${label} task`);
    }
  };

  if (!task) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>{task.name}</DialogTitle>
          <p className="text-sm text-muted-foreground">{task.description}</p>
        </DialogHeader>

        <div className="space-y-6">
          {/* Progress */}
          <TaskProgress task={task} />

          {/* Actions */}
          <div className="flex gap-2 flex-wrap">
            {task.pausable &&
              task.status === "running" && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    handleAction(
                      () =>
                        pauseMutation.mutateAsync({
                          taskId: task.id,
                        }),
                      "pause"
                    )
                  }
                  disabled={pauseMutation.isPending}
                >
                  <Pause className="h-4 w-4 mr-2" />
                  Pause
                </Button>
              )}

            {task.pausable &&
              task.status === "paused" && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    handleAction(
                      () =>
                        resumeMutation.mutateAsync({
                          taskId: task.id,
                        }),
                      "resume"
                    )
                  }
                  disabled={resumeMutation.isPending}
                >
                  <Play className="h-4 w-4 mr-2" />
                  Resume
                </Button>
              )}

            {task.cancellable &&
              (task.status === "running" ||
                task.status === "paused" ||
                task.status === "pending") && (
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() =>
                    handleAction(
                      () =>
                        cancelMutation.mutateAsync({
                          taskId: task.id,
                        }),
                      "cancel"
                    )
                  }
                  disabled={cancelMutation.isPending}
                >
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
              )}

            {task.status === "failed" && (
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  handleAction(
                    () =>
                      retryMutation.mutateAsync({
                        taskId: task.id,
                      }),
                    "retry"
                  )
                }
                disabled={retryMutation.isPending}
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Retry
              </Button>
            )}
          </div>

          {/* Logs */}
          <div>
            <h3 className="font-semibold text-sm mb-2">Activity Log</h3>
            <ScrollArea className="h-48 border rounded-lg p-4">
              <div className="space-y-2 text-xs">
                {logs.length === 0 ? (
                  <p className="text-muted-foreground">No logs yet</p>
                ) : (
                  logs.map((log, i) => (
                    <div
                      key={i}
                      className={`font-mono ${
                        log.level === "error"
                          ? "text-red-600"
                          : log.level === "warning"
                            ? "text-yellow-600"
                            : "text-muted-foreground"
                      }`}
                    >
                      <span className="opacity-60">{log.timestamp}</span>{" "}
                      <span className="font-semibold">[{log.level}]</span>{" "}
                      {log.message}
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>

          {/* Metadata */}
          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <p className="text-muted-foreground">Task ID</p>
              <p className="font-mono truncate">{task.id}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Type</p>
              <p className="font-semibold capitalize">{task.taskType}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Created</p>
              <p className="text-xs">
                {task.createdAt
                  ? new Date(task.createdAt).toLocaleString()
                  : "--"}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Status</p>
              <p className="capitalize font-semibold">{task.status}</p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
