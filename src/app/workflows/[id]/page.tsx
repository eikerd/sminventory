"use client";

import { use, useEffect } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { Sidebar } from "@/components/layout/sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { DataTable } from "@/components/ui/data-table";
import { logger } from "@/lib/logger";
import { ErrorHandler } from "@/lib/error-handler";
import {
  ArrowLeft,
  CheckCircle,
  XCircle,
  Cloud,
  AlertCircle,
  HardDrive,
  RefreshCw,
  Download,
  FolderTree,
  Network,
  Table2,
  AlertTriangle,
} from "lucide-react";
import Link from "next/link";
import { WORKFLOW_STATUS, DEP_STATUS } from "@/lib/config";

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

function getStatusIcon(status: string | null) {
  switch (status) {
    case DEP_STATUS.RESOLVED_LOCAL:
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    case DEP_STATUS.RESOLVED_WAREHOUSE:
      return <Cloud className="h-4 w-4 text-blue-500" />;
    case DEP_STATUS.MISSING:
      return <XCircle className="h-4 w-4 text-red-500" />;
    case DEP_STATUS.INCOMPATIBLE:
      return <AlertCircle className="h-4 w-4 text-orange-500" />;
    default:
      return <AlertCircle className="h-4 w-4 text-gray-500" />;
  }
}

function getStatusLabel(status: string | null) {
  switch (status) {
    case DEP_STATUS.RESOLVED_LOCAL:
      return "Local";
    case DEP_STATUS.RESOLVED_WAREHOUSE:
      return "Warehouse";
    case DEP_STATUS.MISSING:
      return "Missing";
    case DEP_STATUS.INCOMPATIBLE:
      return "Incompatible";
    default:
      return "Unresolved";
  }
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

  // Group dependencies by model type
  const depsByType = dependencies.reduce((acc, dep) => {
    const type = dep.modelType || "unknown";
    if (!acc[type]) acc[type] = [];
    acc[type].push(dep);
    return acc;
  }, {} as Record<string, typeof dependencies>);

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

          {/* Dependencies View */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FolderTree className="h-5 w-5" />
                Dependencies
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="tree" className="w-full">
                <TabsList>
                  <TabsTrigger value="tree" className="flex items-center gap-2">
                    <FolderTree className="h-4 w-4" />
                    Tree View
                  </TabsTrigger>
                  <TabsTrigger value="table" className="flex items-center gap-2">
                    <Table2 className="h-4 w-4" />
                    Table View
                  </TabsTrigger>
                  <TabsTrigger value="graph" className="flex items-center gap-2">
                    <Network className="h-4 w-4" />
                    Graph View
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="tree" className="mt-4">
                  <ScrollArea className="h-[400px]">
                    {dependencies.length === 0 ? (
                      <div className="flex items-center justify-center h-[400px] text-muted-foreground">
                        <div className="text-center">
                          {workflow.status === WORKFLOW_STATUS.SCANNED_ERROR ? (
                            <>
                              <AlertTriangle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                              <p>No dependencies found (workflow scan failed)</p>
                            </>
                          ) : workflow.status === WORKFLOW_STATUS.NEW ? (
                            <>
                              <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                              <p>Workflow not scanned yet</p>
                              <p className="text-xs mt-1">Click Rescan button to analyze</p>
                            </>
                          ) : (
                            <>
                              <CheckCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                              <p>No dependencies required</p>
                            </>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {Object.entries(depsByType).map(([type, deps]) => (
                          <div key={type}>
                            <h3 className="text-sm font-semibold text-muted-foreground uppercase mb-2">
                              {type}s ({deps.length})
                            </h3>
                            <div className="space-y-1 pl-4 border-l-2 border-muted">
                              {deps.map((dep) => (
                                <div
                                  key={dep.id}
                                  className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-muted/50"
                                >
                                  <div className="flex items-center gap-3">
                                    {getStatusIcon(dep.status)}
                                    <span className="font-mono text-sm">{dep.modelName}</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Badge variant="outline" className="text-xs">
                                      {getStatusLabel(dep.status)}
                                    </Badge>
                                    {dep.status === DEP_STATUS.MISSING && (
                                      <Button size="sm" variant="ghost">
                                        <Download className="h-3 w-3" />
                                      </Button>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </TabsContent>

                <TabsContent value="table" className="mt-4">
                  {dependencies.length === 0 ? (
                    <div className="flex items-center justify-center h-[400px] text-muted-foreground border rounded-lg">
                      <div className="text-center">
                        {workflow.status === WORKFLOW_STATUS.SCANNED_ERROR ? (
                          <>
                            <AlertTriangle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                            <p>No dependencies found (workflow scan failed)</p>
                          </>
                        ) : workflow.status === WORKFLOW_STATUS.NEW ? (
                          <>
                            <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                            <p>Workflow not scanned yet</p>
                            <p className="text-xs mt-1">Click Rescan button to analyze</p>
                          </>
                        ) : (
                          <>
                            <CheckCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                            <p>No dependencies required</p>
                          </>
                        )}
                      </div>
                    </div>
                  ) : (
                    <DataTable
                      columns={[
                        {
                          header: "Model Name",
                          accessor: (dep) => (
                            <span className="font-mono text-sm">{dep.modelName}</span>
                          ),
                          sortKey: "modelName",
                          sortable: true,
                          className: "w-[35%]",
                        },
                        {
                          header: "Type",
                          accessor: (dep) => (
                            <Badge variant="outline">{dep.modelType || "unknown"}</Badge>
                          ),
                          sortKey: "modelType",
                          sortable: true,
                          className: "w-[15%]",
                        },
                        {
                          header: "Status",
                          accessor: (dep) => (
                            <div className="flex items-center gap-2">
                              {getStatusIcon(dep.status)}
                              <Badge variant="outline" className="text-xs">
                                {getStatusLabel(dep.status)}
                              </Badge>
                            </div>
                          ),
                          sortKey: "status",
                          sortable: true,
                          className: "w-[20%]",
                        },
                        {
                          header: "Size",
                          accessor: (dep) => (
                            <span className="text-sm text-muted-foreground">
                              {dep.estimatedSize ? formatBytes(dep.estimatedSize) : "--"}
                            </span>
                          ),
                          sortKey: "estimatedSize",
                          sortable: true,
                          className: "w-[15%]",
                        },
                        {
                          header: "Action",
                          accessor: (dep) =>
                            dep.status === DEP_STATUS.MISSING ? (
                              <Button size="sm" variant="ghost">
                                <Download className="h-3 w-3" />
                              </Button>
                            ) : null,
                          className: "w-[15%]",
                        },
                      ]}
                      data={dependencies}
                      defaultSortKey="modelName"
                      defaultSortDirection="asc"
                      emptyMessage="No dependencies found."
                    />
                  )}
                </TabsContent>

                <TabsContent value="graph" className="mt-4">
                  <div className="h-[400px] flex items-center justify-center border rounded-lg bg-muted/20">
                    <div className="text-center text-muted-foreground">
                      <Network className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p>Graph view coming soon</p>
                      <p className="text-sm">Install react-flow for interactive dependency graphs</p>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
  );
}
