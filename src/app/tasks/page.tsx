"use client";

import { useState, Suspense } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TaskProgress } from "@/components/ui/task-progress";
import { TaskDetailModal } from "@/components/task-detail-modal";
import { trpc } from "@/lib/trpc";
import { useTaskPolling } from "@/hooks/use-task-polling";
import { TASK_STATUS } from "@/lib/config";
import { Pause, Play, X, RefreshCw, Trash2 } from "lucide-react";

function TasksContent() {
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Get stats
  const statsQuery = trpc.tasks.stats.useQuery(undefined, {
    refetchInterval: autoRefresh ? 2000 : false,
  });

  // Get active tasks
  const activeQuery = trpc.tasks.list.useQuery(
    { status: TASK_STATUS.RUNNING, limit: 100 },
    {
      refetchInterval: autoRefresh ? 2000 : false,
    }
  );

  // Get history
  const historyQuery = trpc.tasks.list.useQuery(
    { limit: 50 },
    {
      refetchInterval: autoRefresh ? 5000 : false,
    }
  );

  // Batch mutations
  const pauseAll = trpc.tasks.pauseAll.useMutation();
  const cancelAll = trpc.tasks.cancelAll.useMutation();
  const clearCompleted = trpc.tasks.clearCompleted.useMutation();

  // Get selected task details
  const selectedTask = selectedTaskId
    ? activeQuery.data?.find((t) => t.id === selectedTaskId) ||
      historyQuery.data?.find((t) => t.id === selectedTaskId)
    : null;

  const handleRefresh = async () => {
    await Promise.all([
      statsQuery.refetch(),
      activeQuery.refetch(),
      historyQuery.refetch(),
    ]);
  };

  const stats = statsQuery.data || {
    total: 0,
    active: 0,
    queued: 0,
    completed: 0,
    failed: 0,
    paused: 0,
  };

  return (
    <div className="flex h-screen">
      <Sidebar />

      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="border-b bg-card px-6 py-4">
          <h1 className="text-2xl font-bold">Task Manager</h1>
          <p className="text-sm text-muted-foreground">
            Monitor background operations and downloads
          </p>
        </div>

        <main className="flex-1 overflow-auto p-6 space-y-6">
          {/* Stats */}
          <div className="grid gap-4 md:grid-cols-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Total</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-500">
                  {stats.total}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Active</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-500">
                  {stats.active}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Queued</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-yellow-500">
                  {stats.queued}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">
                  Completed
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-500">
                  {stats.completed}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Paused</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-500">
                  {stats.paused}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Failed</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-500">
                  {stats.failed}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Active Tasks */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Active Tasks</CardTitle>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setAutoRefresh(!autoRefresh)}
                  >
                    <RefreshCw className="h-4 w-4 mr-2" />
                    {autoRefresh ? "Pause" : "Resume"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => pauseAll.mutate()}
                    disabled={stats.active === 0}
                  >
                    <Pause className="h-4 w-4 mr-2" />
                    Pause All
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => cancelAll.mutate()}
                    disabled={stats.active + stats.queued === 0}
                  >
                    <X className="h-4 w-4 mr-2" />
                    Cancel All
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {activeQuery.isLoading ? (
                <div className="text-center py-8 text-muted-foreground">
                  Loading...
                </div>
              ) : activeQuery.data?.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No active tasks
                </div>
              ) : (
                <div className="space-y-4">
                  {activeQuery.data?.map((task) => (
                    <div
                      key={task.id}
                      className="p-4 border rounded-lg cursor-pointer hover:bg-accent"
                      onClick={() => setSelectedTaskId(task.id)}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <p className="font-semibold">{task.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {task.description}
                          </p>
                        </div>
                        <Badge variant="outline" className="capitalize">
                          {task.status}
                        </Badge>
                      </div>
                      <TaskProgress task={task} compact />
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* History */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Task History</CardTitle>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => clearCompleted.mutate()}
                  disabled={stats.completed === 0}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Clear Completed
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {historyQuery.isLoading ? (
                <div className="text-center py-8 text-muted-foreground">
                  Loading...
                </div>
              ) : historyQuery.data?.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No tasks
                </div>
              ) : (
                <div className="space-y-2">
                  {historyQuery.data?.map((task) => (
                    <div
                      key={task.id}
                      className="p-3 border rounded flex items-center justify-between cursor-pointer hover:bg-accent"
                      onClick={() => setSelectedTaskId(task.id)}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">
                          {task.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {task.completedAt
                            ? new Date(task.completedAt).toLocaleString()
                            : "In progress"}
                        </p>
                      </div>
                      <Badge variant="outline" className="capitalize">
                        {task.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </main>
      </div>

      {/* Detail Modal */}
      {selectedTaskId && (
        <TaskDetailModal
          open={!!selectedTaskId}
          onOpenChange={(open) => !open && setSelectedTaskId(null)}
          task={selectedTask || null}
          logs={[]} // Would fetch logs in real implementation
        />
      )}
    </div>
  );
}

export default function TasksPage() {
  return (
    <Suspense fallback={<div className="flex h-screen"><div className="flex-1" /></div>}>
      <TasksContent />
    </Suspense>
  );
}
