"use client";

import { Sidebar } from "@/components/layout/sidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { DataTable } from "@/components/ui/data-table";
import {
  Download,
  Pause,
  Play,
  X,
  CheckCircle,
  AlertCircle,
  Clock,
} from "lucide-react";

// Placeholder - will be connected to download queue in Phase 3
type Download = {
  modelName: string;
  source: string;
  modelType: string;
  status: string;
  progress: number;
  downloaded: number;
  total: number;
  speed: string;
};

const mockDownloads: Download[] = [
  // Empty for now - downloads will be populated when download manager is implemented
];

function getStatusIcon(status: string) {
  switch (status) {
    case "completed":
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    case "failed":
      return <AlertCircle className="h-4 w-4 text-red-500" />;
    case "paused":
      return <Clock className="h-4 w-4 text-yellow-500" />;
    default:
      return <Download className="h-4 w-4 text-blue-500" />;
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

export default function DownloadsPage() {
  return (
    <div className="flex h-screen">
      <Sidebar />

      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="border-b bg-card px-6 py-4">
          <h1 className="text-2xl font-bold">Downloads</h1>
          <p className="text-sm text-muted-foreground">Manage model downloads</p>
        </div>

        <main className="flex-1 overflow-auto p-6 space-y-6">
          {/* Stats */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Active</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-blue-500">0</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Queued</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-yellow-500">0</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Completed</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-500">0</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Failed</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-500">0</div>
              </CardContent>
            </Card>
          </div>

          {/* Download Queue */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Download Queue</CardTitle>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled>
                    <Pause className="h-4 w-4 mr-2" />
                    Pause All
                  </Button>
                  <Button variant="outline" size="sm" disabled>
                    <X className="h-4 w-4 mr-2" />
                    Clear Completed
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {mockDownloads.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground">
                  <Download className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No downloads in queue</p>
                  <p className="text-sm">
                    Missing models from workflows will appear here when you request downloads
                  </p>
                </div>
              ) : (
                <DataTable
                  columns={[
                    {
                      header: "Model Name",
                      accessor: (download) => (
                        <div className="space-y-1">
                          <p className="font-medium">{download.modelName}</p>
                          <p className="text-xs text-muted-foreground">{download.source}</p>
                        </div>
                      ),
                      sortKey: "modelName",
                      sortable: true,
                      className: "w-[25%]",
                    },
                    {
                      header: "Type",
                      accessor: (download) => (
                        <Badge variant="outline">{download.modelType}</Badge>
                      ),
                      sortKey: "modelType",
                      sortable: true,
                      className: "w-[12%]",
                    },
                    {
                      header: "Status",
                      accessor: (download) => (
                        <div className="flex items-center gap-2">
                          {getStatusIcon(download.status)}
                          <span className="text-sm capitalize">{download.status}</span>
                        </div>
                      ),
                      sortKey: "status",
                      sortable: true,
                      className: "w-[12%]",
                    },
                    {
                      header: "Progress",
                      accessor: (download) => (
                        <div className="flex items-center gap-2">
                          <Progress value={download.progress} className="h-2 w-24" />
                          <span className="text-xs text-muted-foreground w-12">{download.progress}%</span>
                        </div>
                      ),
                      sortKey: "progress",
                      sortable: true,
                      className: "w-[20%]",
                    },
                    {
                      header: "Size",
                      accessor: (download) => (
                        <span className="text-sm text-muted-foreground">
                          {formatBytes(download.downloaded)} / {formatBytes(download.total)}
                        </span>
                      ),
                      sortKey: "total",
                      sortable: true,
                      className: "w-[15%]",
                    },
                    {
                      header: "Speed",
                      accessor: (download) => (
                        <span className="text-sm text-muted-foreground">{download.speed}</span>
                      ),
                      className: "w-[10%]",
                    },
                    {
                      header: "Actions",
                      accessor: (download) => (
                        <div className="flex gap-1">
                          {download.status === "downloading" ? (
                            <Button size="sm" variant="ghost" disabled>
                              <Pause className="h-3 w-3" />
                            </Button>
                          ) : (
                            <Button size="sm" variant="ghost" disabled>
                              <Play className="h-3 w-3" />
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" disabled>
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ),
                      className: "w-[6%]",
                    },
                  ]}
                  data={mockDownloads}
                  emptyMessage="No downloads in queue. Missing models from workflows will appear here when you request downloads."
                />
              )}
            </CardContent>
          </Card>

          {/* Info Card */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Download Manager</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                The download manager will automatically:
              </p>
              <ul className="text-sm text-muted-foreground space-y-2 list-disc list-inside">
                <li>Download missing models from CivitAI or HuggingFace</li>
                <li>Validate file integrity after download using SHA256</li>
                <li>Resume interrupted downloads</li>
                <li>Respect rate limits and concurrent download limits</li>
                <li>Place files in the correct directory structure</li>
              </ul>
              <div className="flex gap-2 pt-4">
                <Badge variant="outline">
                  <Clock className="h-3 w-3 mr-1" />
                  Coming in Phase 3
                </Badge>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
  );
}
