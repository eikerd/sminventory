"use client";

import { Suspense } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { trpc } from "@/lib/trpc";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  HardDrive,
  Cloud,
  CheckCircle,
  AlertCircle,
  XCircle,
  FileQuestion,
  Sparkles,
  Loader2,
  ArrowLeft,
  FolderOpen,
  File,
  Database,
  Copy,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { CONFIG } from "@/lib/config";

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

function formatDate(dateString: string | null): string {
  if (!dateString) return "-";
  return new Date(dateString).toLocaleString();
}

function getHashStatusIcon(status: string | null) {
  switch (status) {
    case "valid":
      return <CheckCircle className="h-5 w-5 text-green-500" />;
    case "corrupt":
      return <XCircle className="h-5 w-5 text-red-500" />;
    case "incomplete":
      return <AlertCircle className="h-5 w-5 text-yellow-500" />;
    default:
      return <FileQuestion className="h-5 w-5 text-gray-500" />;
  }
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text);
  toast.success("Copied to clipboard");
}

function ModelDetailContent() {
  const params = useParams();
  const router = useRouter();
  const modelId = params.id as string;

  const modelQuery = trpc.models.get.useQuery({ id: modelId });
  const hasApiKey = trpc.civitai.hasApiKey.useQuery();

  const identifyModel = trpc.civitai.identifyModel.useMutation({
    onSuccess: (data) => {
      if (data.identified) {
        toast.success(`Identified: ${data.result?.modelName}`);
        modelQuery.refetch();
      } else {
        toast.info("Model not found on CivitAI");
      }
    },
    onError: (e) => toast.error(e.message || "Lookup failed"),
  });

  const model = modelQuery.data;

  if (modelQuery.isLoading) {
    return (
      <div className="flex h-screen">
        <Sidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <Header title="Model Details" />
          <main className="flex-1 overflow-auto p-6 space-y-6">
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-96 w-full" />
          </main>
        </div>
      </div>
    );
  }

  if (!model) {
    return (
      <div className="flex h-screen">
        <Sidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <Header title="Model Not Found" />
          <main className="flex-1 overflow-auto p-6">
            <Card>
              <CardContent className="pt-6">
                <div className="text-center py-10 text-muted-foreground">
                  <FileQuestion className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium mb-2">Model not found</p>
                  <p className="text-sm mb-4">The requested model could not be found.</p>
                  <Button onClick={() => router.push("/models")}>
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back to Models
                  </Button>
                </div>
              </CardContent>
            </Card>
          </main>
        </div>
      </div>
    );
  }

  // Calculate relative paths
  const basePath = model.location === "local" ? CONFIG.paths.models : CONFIG.paths.warehouse;
  const relativePath = model.filepath.replace(basePath, "").replace(/^\//, "");
  const stabilityMatrixRelative = model.filepath.replace(CONFIG.paths.stabilityMatrix, "").replace(/^\//, "");

  // Parse embedded metadata if it exists
  let embeddedData: any = null;
  try {
    if (model.embeddedMetadata) {
      embeddedData = JSON.parse(model.embeddedMetadata);
    }
  } catch (e) {
    console.error("Failed to parse embedded metadata:", e);
  }

  return (
    <div className="flex h-screen">
      <Sidebar />

      <div className="flex flex-1 flex-col overflow-hidden">
        <Header
          title="Model Details"
          description={model.civitaiName || model.filename}
        />

        <main className="flex-1 overflow-auto p-6">
          <ScrollArea className="h-full">
            <div className="max-w-5xl space-y-6">
              {/* Back Button */}
              <div>
                <Button variant="ghost" onClick={() => router.push("/models")}>
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Models
                </Button>
              </div>

              {/* Path Information - Prominent at Top */}
              <Card className="border-2">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FolderOpen className="h-5 w-5" />
                    File Paths
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Full Path */}
                  <div>
                    <div className="text-sm font-medium text-muted-foreground mb-1">
                      Full Path
                    </div>
                    <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-md font-mono text-sm">
                      <File className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="flex-1 break-all">{model.filepath}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(model.filepath)}
                        title="Copy path"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {/* ComfyUI Relative Path */}
                  <div>
                    <div className="text-sm font-medium text-muted-foreground mb-1">
                      ComfyUI Path (Relative to Models Directory)
                    </div>
                    <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-md font-mono text-sm">
                      <FolderOpen className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="flex-1 break-all">{relativePath}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(relativePath)}
                        title="Copy path"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Stability Matrix Relative Path */}
                  <div>
                    <div className="text-sm font-medium text-muted-foreground mb-1">
                      Stability Matrix Path
                    </div>
                    <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-md font-mono text-sm">
                      <Database className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="flex-1 break-all">{stabilityMatrixRelative}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(stabilityMatrixRelative)}
                        title="Copy path"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Location Badge */}
                  <div>
                    <div className="text-sm font-medium text-muted-foreground mb-1">
                      Storage Location
                    </div>
                    <Badge
                      variant={model.location === "local" ? "default" : "outline"}
                      className="text-sm px-3 py-1"
                    >
                      {model.location === "local" ? (
                        <>
                          <HardDrive className="h-4 w-4 mr-2" />
                          Local Storage
                        </>
                      ) : (
                        <>
                          <Cloud className="h-4 w-4 mr-2" />
                          Warehouse
                        </>
                      )}
                    </Badge>
                  </div>
                </CardContent>
              </Card>

              {/* Identity & Basic Info */}
              <Card>
                <CardHeader>
                  <CardTitle>Identity & Basic Information</CardTitle>
                </CardHeader>
                <CardContent>
                  <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <dt className="text-sm font-medium text-muted-foreground mb-1">
                        Filename
                      </dt>
                      <dd className="text-sm font-mono break-all">{model.filename}</dd>
                    </div>

                    <div>
                      <dt className="text-sm font-medium text-muted-foreground mb-1">
                        File Size
                      </dt>
                      <dd className="text-sm font-medium">{formatBytes(model.fileSize)}</dd>
                    </div>

                    <div>
                      <dt className="text-sm font-medium text-muted-foreground mb-1">
                        Model Type
                      </dt>
                      <dd>
                        <Badge variant="outline">{model.detectedType || "Unknown"}</Badge>
                      </dd>
                    </div>

                    <div>
                      <dt className="text-sm font-medium text-muted-foreground mb-1">
                        Architecture
                      </dt>
                      <dd>
                        <Badge variant="secondary">{model.detectedArchitecture || "Unknown"}</Badge>
                      </dd>
                    </div>

                    <div>
                      <dt className="text-sm font-medium text-muted-foreground mb-1">
                        Precision
                      </dt>
                      <dd>
                        <Badge variant="outline">{model.detectedPrecision || "Unknown"}</Badge>
                      </dd>
                    </div>

                    <div>
                      <dt className="text-sm font-medium text-muted-foreground mb-1">
                        Model ID (SHA256)
                      </dt>
                      <dd className="flex items-center gap-2">
                        <span className="text-xs font-mono break-all">{model.id}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyToClipboard(model.id)}
                          title="Copy ID"
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </dd>
                    </div>
                  </dl>
                </CardContent>
              </Card>

              {/* Integrity & Hash Status */}
              <Card>
                <CardHeader>
                  <CardTitle>Integrity & Hash Validation</CardTitle>
                </CardHeader>
                <CardContent>
                  <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <dt className="text-sm font-medium text-muted-foreground mb-1">
                        Hash Status
                      </dt>
                      <dd className="flex items-center gap-2">
                        {getHashStatusIcon(model.hashStatus)}
                        <span className="text-sm font-medium capitalize">
                          {model.hashStatus || "Unknown"}
                        </span>
                      </dd>
                    </div>

                    <div>
                      <dt className="text-sm font-medium text-muted-foreground mb-1">
                        Last Verified
                      </dt>
                      <dd className="text-sm">{formatDate(model.lastVerifiedAt)}</dd>
                    </div>

                    {model.expectedHash && (
                      <div className="col-span-2">
                        <dt className="text-sm font-medium text-muted-foreground mb-1">
                          Expected Hash
                        </dt>
                        <dd className="flex items-center gap-2">
                          <span className="text-xs font-mono break-all">{model.expectedHash}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => copyToClipboard(model.expectedHash!)}
                            title="Copy hash"
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </dd>
                      </div>
                    )}

                    {model.partialHash && (
                      <div className="col-span-2">
                        <dt className="text-sm font-medium text-muted-foreground mb-1">
                          Partial Hash (First+Last 10MB)
                        </dt>
                        <dd className="flex items-center gap-2">
                          <span className="text-xs font-mono break-all">{model.partialHash}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => copyToClipboard(model.partialHash!)}
                            title="Copy hash"
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </dd>
                      </div>
                    )}
                  </dl>
                </CardContent>
              </Card>

              {/* CivitAI Information */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>CivitAI Information</CardTitle>
                  {!model.civitaiModelId && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (!hasApiKey.data?.hasKey) {
                          toast.error("Set your CivitAI API key in Settings first");
                          return;
                        }
                        identifyModel.mutate({ modelId: model.id });
                      }}
                      disabled={identifyModel.isPending || hasApiKey.isLoading}
                    >
                      {identifyModel.isPending ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Sparkles className="h-4 w-4 mr-2" />
                      )}
                      Lookup on CivitAI
                    </Button>
                  )}
                </CardHeader>
                <CardContent>
                  {model.civitaiModelId ? (
                    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <dt className="text-sm font-medium text-muted-foreground mb-1">
                          Model ID
                        </dt>
                        <dd className="text-sm font-medium">{model.civitaiModelId}</dd>
                      </div>

                      <div>
                        <dt className="text-sm font-medium text-muted-foreground mb-1">
                          Version ID
                        </dt>
                        <dd className="text-sm font-medium">{model.civitaiVersionId || "-"}</dd>
                      </div>

                      <div className="col-span-2">
                        <dt className="text-sm font-medium text-muted-foreground mb-1">
                          Model Name
                        </dt>
                        <dd className="text-sm font-medium">{model.civitaiName || "-"}</dd>
                      </div>

                      <div>
                        <dt className="text-sm font-medium text-muted-foreground mb-1">
                          Base Model
                        </dt>
                        <dd>
                          <Badge variant="outline">{model.civitaiBaseModel || "Unknown"}</Badge>
                        </dd>
                      </div>

                      {model.civitaiDownloadUrl && (
                        <div className="col-span-2">
                          <dt className="text-sm font-medium text-muted-foreground mb-1">
                            Download URL
                          </dt>
                          <dd className="flex items-center gap-2">
                            <a
                              href={model.civitaiDownloadUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm text-blue-500 hover:underline break-all"
                            >
                              {model.civitaiDownloadUrl}
                              <ExternalLink className="h-3 w-3 inline ml-1" />
                            </a>
                          </dd>
                        </div>
                      )}
                    </dl>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <Sparkles className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No CivitAI information available</p>
                      <p className="text-xs">Click the button above to look up this model</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Embedded Metadata */}
              {(embeddedData || model.triggerWords) && (
                <Card>
                  <CardHeader>
                    <CardTitle>Embedded Metadata</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {model.triggerWords && (
                      <div>
                        <dt className="text-sm font-medium text-muted-foreground mb-2">
                          Trigger Words
                        </dt>
                        <dd className="text-sm bg-muted/50 p-3 rounded-md">
                          {model.triggerWords}
                        </dd>
                      </div>
                    )}

                    {embeddedData && (
                      <div>
                        <dt className="text-sm font-medium text-muted-foreground mb-2">
                          Full Metadata (JSON)
                        </dt>
                        <dd>
                          <ScrollArea className="h-64 w-full">
                            <pre className="text-xs bg-muted/50 p-4 rounded-md overflow-x-auto">
                              {JSON.stringify(embeddedData, null, 2)}
                            </pre>
                          </ScrollArea>
                        </dd>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Timestamps */}
              <Card>
                <CardHeader>
                  <CardTitle>Timestamps</CardTitle>
                </CardHeader>
                <CardContent>
                  <dl className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <dt className="text-sm font-medium text-muted-foreground mb-1">
                        Created
                      </dt>
                      <dd className="text-sm">{formatDate(model.createdAt)}</dd>
                    </div>

                    <div>
                      <dt className="text-sm font-medium text-muted-foreground mb-1">
                        Last Verified
                      </dt>
                      <dd className="text-sm">{formatDate(model.lastVerifiedAt)}</dd>
                    </div>

                    <div>
                      <dt className="text-sm font-medium text-muted-foreground mb-1">
                        Last Updated
                      </dt>
                      <dd className="text-sm">{formatDate(model.updatedAt)}</dd>
                    </div>
                  </dl>
                </CardContent>
              </Card>
            </div>
          </ScrollArea>
        </main>
      </div>
    </div>
  );
}

export default function ModelDetailPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen">
          <div className="flex-1" />
        </div>
      }
    >
      <ModelDetailContent />
    </Suspense>
  );
}
