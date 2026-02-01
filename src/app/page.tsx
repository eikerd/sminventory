"use client";

import { useState, Suspense } from "react";
import { trpc } from "@/lib/trpc";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { DataTable } from "@/components/ui/data-table";
import { ViewSwitcher } from "@/components/ui/view-switcher";
import { useViewMode } from "@/hooks/use-view-mode";
import {
  Layers,
  HardDrive,
  CheckCircle,
  AlertCircle,
  Search,
} from "lucide-react";

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

function DashboardContent() {
  const [searchQuery, setSearchQuery] = useState("");
  const { viewMode, setViewMode } = useViewMode();

  // Fetch data
  const workflowsQuery = trpc.workflows.list.useQuery({ search: searchQuery || undefined });
  const workflowStats = trpc.workflows.stats.useQuery();
  const modelStats = trpc.models.stats.useQuery();
  
  // Mutations
  const scanWorkflows = trpc.workflows.scan.useMutation({
    onSuccess: () => {
      workflowsQuery.refetch();
      workflowStats.refetch();
    },
  });
  const scanModels = trpc.models.scan.useMutation({
    onSuccess: () => {
      modelStats.refetch();
    },
  });

  const handleScanAll = async () => {
    await scanModels.mutateAsync({});
    await scanWorkflows.mutateAsync();
  };

  const isScanning = scanWorkflows.isPending || scanModels.isPending;

  return (
    <div className="flex h-screen">
      <Sidebar />
      
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header 
          title="Dashboard" 
          description="Workflow warehouse overview"
          onScan={handleScanAll}
          scanning={isScanning}
        />
        
        <main className="flex-1 overflow-auto p-6 space-y-6">
          {/* Stats Cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Workflows</CardTitle>
                <Layers className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {workflowStats.data?.total ?? <Skeleton className="h-8 w-16" />}
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Models</CardTitle>
                <HardDrive className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {modelStats.data?.total ?? <Skeleton className="h-8 w-16" />}
                </div>
                {modelStats.data && (
                  <p className="text-xs text-muted-foreground">
                    {formatBytes(modelStats.data.totalSize)}
                  </p>
                )}
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Ready to Run</CardTitle>
                <CheckCircle className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-500">
                  {workflowStats.data?.byStatus?.["scanned-ready-local"] ?? 0}
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Missing Dependencies</CardTitle>
                <AlertCircle className="h-4 w-4 text-yellow-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-yellow-500">
                  {workflowStats.data?.byStatus?.["scanned-missing-items"] ?? 0}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Model Stats by Type */}
          {modelStats.data && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Models by Type</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(modelStats.data.byType).map(([type, count]) => (
                    <Badge key={type} variant="secondary" className="text-sm">
                      {type}: {count}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search workflows..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          <Card>
            <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle>Workflows</CardTitle>
                <p className="text-sm text-muted-foreground">Spreadsheet overview of every workflow</p>
              </div>
              <ViewSwitcher
                viewMode={viewMode}
                onViewChange={setViewMode}
                disabled={workflowsQuery.isLoading}
                showCards={false}
              />
            </CardHeader>
            <CardContent className="p-0">
              {workflowsQuery.isLoading ? (
                <div className="p-6 space-y-3">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="grid grid-cols-6 gap-4">
                      <Skeleton className="h-4" />
                      <Skeleton className="h-4" />
                      <Skeleton className="h-4" />
                      <Skeleton className="h-4" />
                      <Skeleton className="h-4" />
                      <Skeleton className="h-4" />
                    </div>
                  ))}
                </div>
              ) : workflowsQuery.data?.workflows.length === 0 ? (
              <div className="py-10 text-center text-muted-foreground">
                <Layers className="mx-auto h-12 w-12 mb-4 opacity-50" />
                <p>No workflows found.</p>
                <p className="text-sm">Click Scan All to discover workflows in your Stability Matrix installation.</p>
              </div>
              ) : (
                <DataTable
                  columns={[
                    {
                      header: "Workflow",
                      accessor: (workflow) => (
                        <div className="space-y-1">
                          <p className="font-medium line-clamp-1">{workflow.name || workflow.filename}</p>
                          <p className="text-xs text-muted-foreground line-clamp-1">{workflow.filepath}</p>
                        </div>
                      ),
                      className: "w-[28%]",
                      sortKey: "name",
                      sortable: true,
                    },
                    {
                      header: "Status",
                      accessor: (workflow) => {
                        const variant = (() => {
                          switch (workflow.status) {
                            case "scanned-ready-local":
                              return "default" as const;
                            case "scanned-ready-cloud":
                              return "secondary" as const;
                            case "scanned-missing-items":
                              return "outline" as const;
                            case "scanned-error":
                              return "destructive" as const;
                            default:
                              return "outline" as const;
                          }
                        })();
                        return (
                          <Badge variant={variant} className="capitalize">
                            {workflow.status?.replace("scanned-", "").replace(/-/g, " ") || "new"}
                          </Badge>
                        );
                      },
                      sortKey: "status",
                      sortable: true,
                    },
                    {
                      header: "Dependencies",
                      accessor: (workflow) => {
                        const total = workflow.totalDependencies || 0;
                        const resolved = (workflow.resolvedLocal || 0) + (workflow.resolvedWarehouse || 0);
                        const missing = workflow.missingCount || Math.max(total - resolved, 0);
                        return (
                          <div className="text-sm">
                            <span className="font-semibold text-green-500">{resolved}</span>
                            <span className="text-muted-foreground"> / {total}</span>
                            {missing > 0 && (
                              <span className="ml-2 text-xs text-red-500">{missing} missing</span>
                            )}
                          </div>
                        );
                      },
                      sortKey: "totalDependencies",
                      sortable: true,
                    },
                    {
                      header: "VRAM",
                      accessor: (workflow) =>
                        workflow.estimatedVramGb ? `${workflow.estimatedVramGb.toFixed(1)} GB` : "--",
                      sortKey: "estimatedVramGb",
                      sortable: true,
                    },
                    {
                      header: "Total Size",
                      accessor: (workflow) => formatBytes(workflow.totalSizeBytes || 0),
                      sortKey: "totalSizeBytes",
                      sortable: true,
                    },
                    {
                      header: "Last Scan",
                      accessor: (workflow) => (
                        <span className="text-xs text-muted-foreground">
                          {workflow.scannedAt ? new Date(workflow.scannedAt).toLocaleString() : "Pending scan"}
                        </span>
                      ),
                      sortKey: "scannedAt",
                      sortable: true,
                    },
                  ]}
                  data={workflowsQuery.data?.workflows || []}
                  defaultSortKey="scannedAt"
                  defaultSortDirection="desc"
                  emptyMessage="No workflows found. Click Scan All to discover workflows in your Stability Matrix installation."
                />
              )}
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
  );
}

export default function Dashboard() {
  return (
    <Suspense fallback={<div className="flex h-screen"><div className="flex-1" /></div>}>
      <DashboardContent />
    </Suspense>
  );
}
