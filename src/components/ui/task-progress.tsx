import { Progress } from "@/components/ui/progress";
import { formatBytes, formatSpeed, formatEta } from "@/lib/task-utils";
import { Task } from "@/server/db/schema";
import { AlertCircle, CheckCircle, Clock, Loader2 } from "lucide-react";

interface TaskProgressProps {
  task: Task | null;
  compact?: boolean;
}

export function TaskProgress({ task, compact = false }: TaskProgressProps) {
  if (!task) {
    return <div className="text-sm text-muted-foreground">No task data</div>;
  }

  const statusColors: Record<string, string> = {
    pending: "text-yellow-600",
    running: "text-blue-600",
    paused: "text-orange-600",
    completed: "text-green-600",
    failed: "text-red-600",
    cancelled: "text-gray-600",
  };

  const statusIcons: Record<string, React.ReactNode> = {
    pending: <Clock className="h-4 w-4" />,
    running: <Loader2 className="h-4 w-4 animate-spin" />,
    paused: <Clock className="h-4 w-4" />,
    completed: <CheckCircle className="h-4 w-4" />,
    failed: <AlertCircle className="h-4 w-4" />,
    cancelled: <AlertCircle className="h-4 w-4" />,
  };

  if (compact) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={statusColors[task.status || "pending"]}>
              {statusIcons[task.status || "pending"]}
            </div>
            <span className="text-sm font-medium capitalize">
              {task.status}
            </span>
          </div>
          <span className="text-sm text-muted-foreground">
            {task.progress}%
          </span>
        </div>
        <Progress value={task.progress || 0} className="h-2" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Status and Progress */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={statusColors[task.status || "pending"]}>
            {statusIcons[task.status || "pending"]}
          </div>
          <span className="text-sm font-medium capitalize">
            {task.status}
          </span>
        </div>
        <span className="text-sm font-semibold">{task.progress}%</span>
      </div>

      <Progress value={task.progress || 0} className="h-3" />

      {/* Detailed Info */}
      <div className="grid grid-cols-2 gap-4 text-xs">
        <div>
          <span className="text-muted-foreground">Progress</span>
          <p className="font-semibold">
            {formatBytes(task.currentBytes || 0)} /{" "}
            {formatBytes(task.totalBytes || 0)}
          </p>
        </div>

        <div>
          <span className="text-muted-foreground">Speed</span>
          <p className="font-semibold">
            {formatSpeed(task.speed || 0)}
          </p>
        </div>

        <div>
          <span className="text-muted-foreground">ETA</span>
          <p className="font-semibold">
            {formatEta(task.eta)}
          </p>
        </div>

        <div>
          <span className="text-muted-foreground">Retries</span>
          <p className="font-semibold">
            {task.retryCount || 0} / {task.maxRetries || 3}
          </p>
        </div>
      </div>

      {/* Error Message */}
      {task.errorMessage && (
        <div className="rounded bg-destructive/10 p-3">
          <p className="text-xs text-destructive">{task.errorMessage}</p>
        </div>
      )}
    </div>
  );
}
