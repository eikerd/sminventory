"use client";

import { use, useEffect } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Sidebar } from "@/components/layout/sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { logger } from "@/lib/logger";
import { ErrorHandler } from "@/lib/error-handler";
import {
  ArrowLeft,
  HardDrive,
  RefreshCw,
  Download,
  AlertTriangle,
} from "lucide-react";
import Link from "next/link";
import { WORKFLOW_STATUS } from "@/lib/config";
import { WorkflowDependencyTree } from "@/components/workflow-dependency-tree";

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

export default function WorkflowDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  const workflowQuery = trpc.workflows.get.useQuery({ id });

  const resolveDeps = trpc.workflows.resolveDependencies.useMutation({
    onSuccess: () => {
      logger.info("Dependencies resolved", { workflowId: id });
      toast.success("Dependencies resolved successfully");
      workflowQuery.refetch();
    },
    onError: (error) => {
      ErrorHandler.handleWorkflowError(error, id);
    },
  });

  useEffect(() => {
    if (workflowQuery.error) {
      logger.error("Failed to load workflow", workflowQuery.error, { workflowId: id });
      ErrorHandler.handleWorkflowError(workflowQuery.error, id);
    }
  }, [workflowQuery.error, id]);

  const workflow = workflowQuery.data?.workflow;
  const dependencies = workflowQuery.data?.dependencies || [];

  logger.debug("Workflow detail loaded", {
    workflowId: id,
    hasDependencies: dependencies.length > 0,
    status: workflow?.status
  });

  const total = workflow?.totalDependencies || 0;
  const resolved = (workflow?.resolvedLocal || 0) + (workflow?.resolvedWarehouse || 0);
  const progress = total > 0 ? (resolved / total) * 100 : 0;

  if (workflowQuery.isLoading) {
    return (
      <div className="flex h-screen">
        <Sidebar />
        <div className="flex-1 p-6">
          <Skeleton className="h-8 w-64 mb-4" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (!workflow) {
    return (
      <div className="flex h-screen">
        <Sidebar />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-2xl font-bold">Workflow not found</h2>
            <Link href="/">
              <Button className="mt-4">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Dashboard
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen">
      <Sidebar />
      
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b bg-card px-6 py-4">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold">{workflow.name || workflow.filename}</h1>
              <p className="text-sm text-muted-foreground">{workflow.filepath}</p>
            </div>
          </div>
          
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={() => resolveDeps.mutate({ id })}
              disabled={resolveDeps.isPending}
            >
              {resolveDeps.isPending ? (
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              Rescan
            </Button>
            {workflow.missingCount && workflow.missingCount > 0 && (
              <Button>
                <Download className="mr-2 h-4 w-4" />
                Download Missing
              </Button>
            )}
          </div>
        </div>

        <main className="flex-1 overflow-auto p-6 space-y-6">
          {/* Error Alert */}
          {workflow.status === WORKFLOW_STATUS.SCANNED_ERROR && (
            <div className="flex items-start gap-3 p-4 rounded-lg border border-red-500/50 bg-red-500/5">
              <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <h3 className="font-semibold text-red-700">Scan Error</h3>
                <p className="text-sm text-red-600 mt-1">
                  This workflow could not be scanned. There may be invalid JSON, unsupported node types, or other parsing issues.
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    logger.info("Retrying workflow scan", { workflowId: id });
                    resolveDeps.mutate({ id });
                  }}
                  disabled={resolveDeps.isPending}
                  className="mt-2"
                >
                  {resolveDeps.isPending && <RefreshCw className="h-3 w-3 mr-2 animate-spin" />}
                  Try Again
                </Button>
              </div>
            </div>
          )}

          {/* Stats Row */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Scan Status</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Badge
                    variant={
                      workflow.status === WORKFLOW_STATUS.SCANNED_READY_LOCAL ? "default" :
                      workflow.status === WORKFLOW_STATUS.SCANNED_ERROR ? "destructive" :
                      "outline"
                    }
                    className="text-sm"
                  >
                    {workflow.status === WORKFLOW_STATUS.SCANNED_READY_LOCAL ? "✓ Ready (Local)" :
                     workflow.status === WORKFLOW_STATUS.SCANNED_READY_CLOUD ? "✓ Ready (Cloud)" :
                     workflow.status === WORKFLOW_STATUS.SCANNED_MISSING ? "⚠ Missing Models" :
                     workflow.status === WORKFLOW_STATUS.SCANNED_ERROR ? "✗ Error" :
                     "○ Not Scanned"}
                  </Badge>
                  {(workflow.scannedAt) && (
                    <p className="text-xs text-gray-500">
                      Last scanned: {new Date(workflow.scannedAt).toLocaleString()}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Dependencies</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="text-2xl font-bold">{resolved}/{total}</div>
                  <Progress value={progress} className="h-2" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Total Size</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <HardDrive className="h-4 w-4 text-muted-foreground" />
                  <span className="text-2xl font-bold">
                    {formatBytes(workflow.totalSizeBytes || 0)}
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">VRAM Estimate</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {workflow.estimatedVramGb ? `~${workflow.estimatedVramGb.toFixed(1)} GB` : "Unknown"}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Dependencies View with VRAM Estimation */}
          <div className="min-h-[500px]">
            <WorkflowDependencyTree workflowId={id} />
          </div>
        </main>
      </div>
    </div>
  );
}
