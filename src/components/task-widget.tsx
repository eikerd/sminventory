"use client";

import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { formatBytes, formatSpeed, formatEta } from "@/lib/task-utils";

export function TaskWidget() {
  const [isExpanded, setIsExpanded] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Error boundary
  if (error) {
    console.error("TaskWidget error:", error);
    return null;
  }

  // Poll for active tasks
  const tasksQuery = trpc.tasks.list.useQuery(
    { status: "running", limit: 100 },
    {
      enabled: autoRefresh,
      refetchInterval: 500,
      staleTime: 0,
      retry: 1,
      retryDelay: 1000,
    }
  );

  const tasks = tasksQuery.data || [];
  const activeCount = tasks.length;
  const totalProgress = tasks.length > 0
    ? Math.round(tasks.reduce((sum, t) => sum + (t.progress || 0), 0) / tasks.length)
    : 0;

  // Log any errors
  if (tasksQuery.error) {
    console.warn("Task widget query error:", tasksQuery.error);
  }

  useEffect(() => {
    // Stop refreshing when no active tasks
    setAutoRefresh(activeCount > 0);
  }, [activeCount]);

  if (activeCount === 0 && !isExpanded) {
    return null; // Hide widget when no tasks and collapsed
  }

  try {
    return (
    <div className="fixed bottom-4 right-4 w-96 bg-[#1a1a1a] border border-gray-800 rounded-lg shadow-lg z-50">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-3 hover:bg-[#222] transition-colors"
      >
        <div className="flex items-center gap-3 flex-1">
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 text-gray-400" />
          ) : (
            <ChevronRight className="h-4 w-4 text-gray-400" />
          )}
          <div className="text-left flex-1">
            <p className="text-sm font-medium text-gray-300">
              {activeCount === 0 ? "No tasks running" : `${activeCount} task${activeCount !== 1 ? "s" : ""} running`}
            </p>
            {activeCount > 0 && (
              <p className="text-xs text-gray-500">{totalProgress}% average progress</p>
            )}
          </div>
        </div>
        {activeCount > 0 && (
          <div className="w-12 h-1.5 bg-gray-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-purple-500 rounded-full transition-all duration-200"
              style={{ width: `${totalProgress}%` }}
            />
          </div>
        )}
      </button>

      {/* Expanded Content */}
      {isExpanded && activeCount > 0 && (
        <div className="border-t border-gray-800 p-3 space-y-3 max-h-96 overflow-y-auto">
          {tasks.map((task) => (
            <div key={task.id} className="space-y-1.5">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-300 truncate">{task.name}</p>
                  <p className="text-xs text-gray-500">{task.taskType}</p>
                </div>
                <span className="text-xs font-mono text-gray-400 whitespace-nowrap">
                  {task.progress || 0}%
                </span>
              </div>

              <Progress
                value={task.progress || 0}
                className="h-1.5"
              />

              {task.totalBytes && task.currentBytes && (
                <div className="flex justify-between text-xs text-gray-500 font-mono">
                  <span>{formatBytes(task.currentBytes)} / {formatBytes(task.totalBytes)}</span>
                  {task.speed && task.eta && (
                    <span>{formatSpeed(task.speed)} - {formatEta(task.eta)}s left</span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Collapsed Content */}
      {!isExpanded && activeCount > 0 && (
        <div className="border-t border-gray-800 px-3 py-2">
          <div className="space-y-1.5">
            {tasks.slice(0, 2).map((task) => (
              <div key={task.id} className="flex items-center justify-between text-xs">
                <span className="text-gray-400 truncate flex-1">{task.name}</span>
                <span className="text-gray-500 ml-2 whitespace-nowrap">{task.progress}%</span>
              </div>
            ))}
            {activeCount > 2 && (
              <p className="text-xs text-gray-500 mt-1">+{activeCount - 2} more...</p>
            )}
          </div>
        </div>
      )}
    </div>
    );
  } catch (err) {
    console.error("TaskWidget render error:", err);
    setError(err instanceof Error ? err : new Error(String(err)));
    return null;
  }
}
