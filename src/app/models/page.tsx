"use client";

import { useState, Suspense } from "react";
import { trpc } from "@/lib/trpc";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { DataTable } from "@/components/ui/data-table";
import { ViewSwitcher } from "@/components/ui/view-switcher";
import { useViewMode } from "@/hooks/use-view-mode";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Search,
  HardDrive,
  Cloud,
  CheckCircle,
  AlertCircle,
  XCircle,
  FileQuestion,
} from "lucide-react";

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

function getHashStatusIcon(status: string | null) {
  switch (status) {
    case "valid":
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    case "corrupt":
      return <XCircle className="h-4 w-4 text-red-500" />;
    case "incomplete":
      return <AlertCircle className="h-4 w-4 text-yellow-500" />;
    default:
      return <FileQuestion className="h-4 w-4 text-gray-500" />;
  }
}

function ModelsContent() {
  const [searchQuery, setSearchQuery] = useState("");
  const [locationFilter, setLocationFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const { viewMode, setViewMode } = useViewMode();

  const modelsQuery = trpc.models.list.useQuery({
    search: searchQuery || undefined,
    location: locationFilter !== "all" ? (locationFilter as "local" | "warehouse") : undefined,
    type: typeFilter !== "all" ? typeFilter : undefined,
    limit: 500,
  });

  const modelStats = trpc.models.stats.useQuery();

  const scanModels = trpc.models.scan.useMutation({
    onSuccess: () => {
      modelsQuery.refetch();
      modelStats.refetch();
    },
  });

  const models = modelsQuery.data?.models || [];

  // Get unique types for filter
  const modelTypes = modelStats.data?.byType ? Object.keys(modelStats.data.byType) : [];

  return (
    <div className="flex h-screen">
      <Sidebar />

      <div className="flex flex-1 flex-col overflow-hidden">
        <Header
          title="Models"
          description="Browse and manage your model inventory"
          onScan={() => scanModels.mutate({})}
          scanning={scanModels.isPending}
        />

        <main className="flex-1 overflow-auto p-6 space-y-6">
          {/* Stats */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Total Models</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {modelStats.data?.total ?? <Skeleton className="h-8 w-16" />}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <HardDrive className="h-4 w-4" />
                  Local
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {modelStats.data?.byLocation?.local ?? 0}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Cloud className="h-4 w-4" />
                  Warehouse
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {modelStats.data?.byLocation?.warehouse ?? 0}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Total Size</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {modelStats.data ? formatBytes(modelStats.data.totalSize) : <Skeleton className="h-8 w-24" />}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filters */}
          <div className="flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search models..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            <Select value={locationFilter} onValueChange={setLocationFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Location" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Locations</SelectItem>
                <SelectItem value="local">Local</SelectItem>
                <SelectItem value="warehouse">Warehouse</SelectItem>
              </SelectContent>
            </Select>

            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {modelTypes.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Model List */}
          <Card>
            <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle>
                Models ({modelsQuery.data?.total ?? 0})
              </CardTitle>
              <ViewSwitcher
                viewMode={viewMode}
                onViewChange={setViewMode}
                disabled={modelsQuery.isLoading}
                showCards={true}
              />
            </CardHeader>
            <CardContent>
              {modelsQuery.isLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 10 }).map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              ) : models.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground">
                  <HardDrive className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No models found.</p>
                  <p className="text-sm">Click &quot;Scan All&quot; to index your models.</p>
                </div>
              ) : viewMode === "table" ? (
                <DataTable
                  columns={[
                    {
                      header: "Filename",
                      accessor: (model) => (
                        <div className="space-y-1">
                          <p className="font-medium">{model.civitaiName || model.filename}</p>
                          <p className="text-xs text-muted-foreground line-clamp-1">{model.filepath}</p>
                        </div>
                      ),
                      sortKey: "filename",
                      sortable: true,
                      className: "w-[30%]",
                    },
                    {
                      header: "Type",
                      accessor: (model) => (
                        <Badge variant="outline">{model.detectedType || "unknown"}</Badge>
                      ),
                      sortKey: "detectedType",
                      sortable: true,
                      className: "w-[15%]",
                    },
                    {
                      header: "Architecture",
                      accessor: (model) => (
                        <Badge variant="secondary">{model.detectedArchitecture || "?"}</Badge>
                      ),
                      sortKey: "detectedArchitecture",
                      sortable: true,
                      className: "w-[15%]",
                    },
                    {
                      header: "Location",
                      accessor: (model) => (
                        <Badge variant={model.location === "local" ? "default" : "outline"}>
                          {model.location === "local" ? (
                            <><HardDrive className="h-3 w-3 mr-1" /> Local</>
                          ) : (
                            <><Cloud className="h-3 w-3 mr-1" /> Warehouse</>
                          )}
                        </Badge>
                      ),
                      sortKey: "location",
                      sortable: true,
                      className: "w-[12%]",
                    },
                    {
                      header: "Size",
                      accessor: (model) => (
                        <span className="text-sm text-muted-foreground">
                          {formatBytes(model.fileSize)}
                        </span>
                      ),
                      sortKey: "fileSize",
                      sortable: true,
                      className: "w-[12%]",
                    },
                    {
                      header: "Status",
                      accessor: (model) => getHashStatusIcon(model.hashStatus),
                      className: "w-[8%]",
                    },
                  ]}
                  data={models}
                  defaultSortKey="filename"
                  defaultSortDirection="asc"
                  emptyMessage="No models found."
                />
              ) : (
                <ScrollArea className="h-[500px]">
                  <div className="space-y-2">
                    {models.map((model) => (
                      <div
                        key={model.id}
                        className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center gap-4 flex-1 min-w-0">
                          {getHashStatusIcon(model.hashStatus)}
                          <div className="min-w-0 flex-1">
                            <div className="font-medium truncate">
                              {model.civitaiName || model.filename}
                            </div>
                            <div className="text-sm text-muted-foreground truncate">
                              {model.filepath}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <Badge variant="outline">{model.detectedType || "unknown"}</Badge>
                          <Badge variant="secondary">{model.detectedArchitecture || "?"}</Badge>
                          <Badge variant={model.location === "local" ? "default" : "outline"}>
                            {model.location === "local" ? (
                              <><HardDrive className="h-3 w-3 mr-1" /> Local</>
                            ) : (
                              <><Cloud className="h-3 w-3 mr-1" /> Warehouse</>
                            )}
                          </Badge>
                          <span className="text-sm text-muted-foreground w-20 text-right">
                            {formatBytes(model.fileSize)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
  );
}

export default function ModelsPage() {
  return (
    <Suspense fallback={<div className="flex h-screen"><div className="flex-1" /></div>}>
      <ModelsContent />
    </Suspense>
  );
}
