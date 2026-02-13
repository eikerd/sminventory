"use client";

import { use, useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { Sidebar } from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  ExternalLink,
  RefreshCw,
  Plus,
  X,
  Save,
  Video,
  Tag,
  Link2,
  Layers,
  Cloud,
  Loader2,
  Search,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { WorkflowDependencyViewer } from "@/components/workflow-dependency-viewer";
import { toast } from "sonner";
import {
  VIDEO_TAG_CATEGORIES,
  MODEL_TYPES,
  BASE_MODELS,
} from "@/lib/config";

function TagBadge({
  category,
  value,
  source,
  onRemove,
}: {
  category: string;
  value: string;
  source: string | null;
  onRemove?: () => void;
}) {
  const colorMap: Record<string, string> = {
    model_type: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    base_model: "bg-purple-500/20 text-purple-400 border-purple-500/30",
    custom: "bg-zinc-500/20 text-zinc-400 border-zinc-500/30",
  };
  const classes = colorMap[category] || colorMap.custom;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium ${classes}`}
    >
      {value}
      {source === "auto" && (
        <span className="text-[10px] opacity-60">(auto)</span>
      )}
      {onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="ml-0.5 hover:opacity-70"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </span>
  );
}

export default function VideoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  // State
  const [cloudRenderUrl, setCloudRenderUrl] = useState("");
  const [cloudRenderDirty, setCloudRenderDirty] = useState(false);
  const [addUrlInput, setAddUrlInput] = useState("");
  const [addUrlLabel, setAddUrlLabel] = useState("");
  const [addTagCategory, setAddTagCategory] = useState<string>(
    VIDEO_TAG_CATEGORIES.MODEL_TYPE
  );
  const [addTagValue, setAddTagValue] = useState("");
  const [expandedWorkflows, setExpandedWorkflows] = useState<Set<string>>(new Set());

  // File input ref for workflow upload
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Toggle workflow expansion
  const toggleWorkflow = (workflowId: string) => {
    setExpandedWorkflows((prev) => {
      const next = new Set(prev);
      if (next.has(workflowId)) {
        next.delete(workflowId);
      } else {
        next.add(workflowId);
      }
      return next;
    });
  };

  // Queries
  const videoQuery = trpc.videos.get.useQuery({ id });

  // Mutations
  const updateVideo = trpc.videos.update.useMutation({
    onSuccess: () => {
      toast.success("Saved");
      setCloudRenderDirty(false);
      videoQuery.refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const refreshMetadata = trpc.videos.refreshMetadata.useMutation({
    onSuccess: () => {
      toast.success("Metadata refreshed");
      videoQuery.refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const uploadWorkflow = trpc.videos.uploadWorkflow.useMutation({
    onSuccess: () => {
      toast.success("Workflow uploaded and added");
      videoQuery.refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const removeWorkflow = trpc.videos.removeWorkflow.useMutation({
    onSuccess: () => {
      toast.success("Workflow unlinked");
      videoQuery.refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const addTag = trpc.videos.addTag.useMutation({
    onSuccess: () => {
      toast.success("Tag added");
      setAddTagValue("");
      videoQuery.refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const removeTag = trpc.videos.removeTag.useMutation({
    onSuccess: () => {
      videoQuery.refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const addUrl = trpc.videos.addUrl.useMutation({
    onSuccess: () => {
      toast.success("URL added");
      setAddUrlInput("");
      setAddUrlLabel("");
      videoQuery.refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const removeUrl = trpc.videos.removeUrl.useMutation({
    onSuccess: () => {
      videoQuery.refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  // Handle workflow file upload
  const handleWorkflowFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file extension
    if (!file.name.endsWith('.json')) {
      toast.error('Please select a .json workflow file');
      return;
    }

    // Read file content
    const reader = new FileReader();
    reader.onload = async (event) => {
      const content = event.target?.result as string;

      // Validate JSON before uploading
      try {
        JSON.parse(content);
      } catch {
        toast.error('Invalid JSON in workflow file');
        return;
      }

      try {
        // Upload workflow
        await uploadWorkflow.mutateAsync({
          videoId: id,
          filename: file.name,
          content,
        });

        // Clear file input
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      } catch (error) {
        // Error displayed by mutation onError callback
        console.debug('Workflow upload failed:', error);
      }
    };

    reader.onerror = () => {
      toast.error('Failed to read file');
    };

    reader.readAsText(file);
  };

  // Sync cloudRenderUrl from video data
  useEffect(() => {
    if (videoQuery.data?.video && !cloudRenderDirty) {
      setCloudRenderUrl(videoQuery.data.video.cloudRenderUrl || "");
    }
  }, [videoQuery.data?.video.cloudRenderUrl, cloudRenderDirty, videoQuery.data?.video]);

  // Loading state
  if (videoQuery.isLoading) {
    return (
      <div className="flex h-screen bg-[#0d0d0d]">
        <Sidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="border-b bg-card px-6 py-4">
            <Skeleton className="h-8 w-64" />
          </div>
          <main className="flex-1 overflow-auto p-6 space-y-6">
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-48 w-full" />
          </main>
        </div>
      </div>
    );
  }

  const data = videoQuery.data;
  if (!data) {
    return (
      <div className="flex h-screen bg-[#0d0d0d]">
        <Sidebar />
        <div className="flex flex-1 flex-col items-center justify-center">
          <p className="text-muted-foreground">Video not found</p>
          <Button variant="ghost" onClick={() => router.push("/videos")} className="mt-4">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Videos
          </Button>
        </div>
      </div>
    );
  }

  const { video, workflows: linkedWorkflows, tags, urls } = data;

  const modelTypeTags = tags.filter(
    (t) => t.category === VIDEO_TAG_CATEGORIES.MODEL_TYPE
  );
  const baseModelTags = tags.filter(
    (t) => t.category === VIDEO_TAG_CATEGORIES.BASE_MODEL
  );
  const customTags = tags.filter(
    (t) => t.category === VIDEO_TAG_CATEGORIES.CUSTOM
  );

  // Get tag options for the selected category
  const tagOptions =
    addTagCategory === VIDEO_TAG_CATEGORIES.MODEL_TYPE
      ? MODEL_TYPES
      : addTagCategory === VIDEO_TAG_CATEGORIES.BASE_MODEL
        ? BASE_MODELS
        : [];

  // Filter out already-applied tags
  const existingTagValues = new Set(
    tags
      .filter((t) => t.category === addTagCategory)
      .map((t) => t.value)
  );
  const availableTagOptions = tagOptions.filter(
    (t) => !existingTagValues.has(t)
  );

  return (
    <div className="flex h-screen bg-[#0d0d0d]">
      <Sidebar />

      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b bg-card px-6 py-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.push("/videos")}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-xl font-bold">
                {video.title || "Untitled Video"}
              </h1>
              <p className="text-sm text-muted-foreground">
                {video.channelName || "Unknown channel"}
                {video.publishedAt &&
                  ` · ${new Date(video.publishedAt).toLocaleDateString()}`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => {
                const win = window.open(video.url, "_blank", "noopener,noreferrer");
                if (win) win.opener = null;
              }}
            >
              <ExternalLink className="mr-2 h-4 w-4" />
              YouTube
            </Button>
            <Button
              variant="outline"
              onClick={() => refreshMetadata.mutate({ id })}
              disabled={refreshMetadata.isPending}
            >
              {refreshMetadata.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              Refresh
            </Button>
          </div>
        </div>

        {/* Content */}
        <main className="flex-1 overflow-auto p-6 space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left column: Video info + Cloud render */}
            <div className="lg:col-span-1 space-y-6">
              {/* Thumbnail */}
              <Card>
                <CardContent className="p-0">
                  {video.thumbnailUrl ? (
                    <img
                      src={video.thumbnailUrl}
                      alt={video.title || ""}
                      className="w-full rounded-t-lg object-cover"
                    />
                  ) : (
                    <div className="w-full h-40 rounded-t-lg bg-muted flex items-center justify-center">
                      <Video className="h-12 w-12 text-muted-foreground" />
                    </div>
                  )}
                  <div className="p-4 space-y-1">
                    {video.duration && (
                      <p className="text-xs text-muted-foreground">
                        Duration: {video.duration}
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Cloud Render URL */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <Cloud className="h-4 w-4" />
                    Cloud Render URL
                  </CardTitle>
                  <CardDescription>
                    RunPod or cloud render endpoint
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-2">
                    <Input
                      placeholder="https://runpod.io/..."
                      value={cloudRenderUrl}
                      onChange={(e) => {
                        setCloudRenderUrl(e.target.value);
                        setCloudRenderDirty(true);
                      }}
                    />
                    <Button
                      size="icon"
                      disabled={!cloudRenderDirty || updateVideo.isPending}
                      onClick={() =>
                        updateVideo.mutate({
                          id,
                          cloudRenderUrl: cloudRenderUrl || undefined,
                        })
                      }
                    >
                      <Save className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Statistics */}
              {(video.viewCount !== null || video.likeCount !== null || video.commentCount !== null) && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Statistics</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {video.viewCount !== null && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Views</span>
                        <span className="font-medium">{video.viewCount.toLocaleString()}</span>
                      </div>
                    )}
                    {video.likeCount !== null && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Likes</span>
                        <span className="font-medium">{video.likeCount.toLocaleString()}</span>
                      </div>
                    )}
                    {video.commentCount !== null && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Comments</span>
                        <span className="font-medium">{video.commentCount.toLocaleString()}</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Video Status */}
              {(video.privacyStatus || video.license || video.uploadStatus) && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Status</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    {video.privacyStatus && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Privacy</span>
                        <span className="font-medium capitalize">{video.privacyStatus}</span>
                      </div>
                    )}
                    {video.license && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">License</span>
                        <span className="font-medium">{video.license === 'youtube' ? 'Standard' : 'Creative Commons'}</span>
                      </div>
                    )}
                    {video.uploadStatus && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Upload</span>
                        <span className="font-medium capitalize">{video.uploadStatus}</span>
                      </div>
                    )}
                    {video.embeddable !== null && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Embeddable</span>
                        <span className="font-medium">{video.embeddable ? 'Yes' : 'No'}</span>
                      </div>
                    )}
                    {video.madeForKids !== null && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Made for Kids</span>
                        <span className="font-medium">{video.madeForKids ? 'Yes' : 'No'}</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Technical Details */}
              {(video.definition || video.dimension || video.projection || video.caption !== null) && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Technical Details</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    {video.definition && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Definition</span>
                        <span className="font-medium uppercase">{video.definition}</span>
                      </div>
                    )}
                    {video.dimension && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Dimension</span>
                        <span className="font-medium uppercase">{video.dimension}</span>
                      </div>
                    )}
                    {video.projection && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Projection</span>
                        <span className="font-medium capitalize">{video.projection}</span>
                      </div>
                    )}
                    {video.caption !== null && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Captions</span>
                        <span className="font-medium">{video.caption ? 'Available' : 'None'}</span>
                      </div>
                    )}
                    {video.licensedContent !== null && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Licensed Content</span>
                        <span className="font-medium">{video.licensedContent ? 'Yes' : 'No'}</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Recording Details */}
              {(video.recordingDate || video.locationDescription) && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Recording Details</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    {video.recordingDate && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Recorded</span>
                        <span className="font-medium">{new Date(video.recordingDate).toLocaleDateString()}</span>
                      </div>
                    )}
                    {video.locationDescription && (
                      <div>
                        <span className="text-muted-foreground">Location</span>
                        <p className="font-medium mt-1">{video.locationDescription}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* URLs */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <Link2 className="h-4 w-4" />
                    URLs
                    <Badge variant="secondary" className="ml-2">
                      {urls.length}
                    </Badge>
                  </CardTitle>
                  <CardDescription>
                    Links found in the video description or manually added.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {urls.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No URLs found. Add a Google API key in Settings to scrape
                      description URLs, or add them manually.
                    </p>
                  ) : (
                    <div className="space-y-1.5">
                      {urls.map((u) => (
                        <div
                          key={u.id}
                          className="flex items-center justify-between rounded-lg border px-3 py-2"
                        >
                          <div className="flex-1 min-w-0">
                            <a
                              href={u.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm font-medium text-primary hover:underline truncate block"
                            >
                              {u.url}
                            </a>
                            {u.label && (
                              <span className="text-xs text-muted-foreground">
                                {u.label}
                              </span>
                            )}
                            {u.source && (
                              <span className="ml-2 text-xs text-muted-foreground">
                                ({u.source})
                              </span>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:text-destructive flex-shrink-0"
                            onClick={() => removeUrl.mutate({ id: u.id })}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex gap-2 pt-2 border-t">
                    <Input
                      placeholder="URL"
                      value={addUrlInput}
                      onChange={(e) => setAddUrlInput(e.target.value)}
                      className="flex-1"
                    />
                    <Input
                      placeholder="Label (optional)"
                      value={addUrlLabel}
                      onChange={(e) => setAddUrlLabel(e.target.value)}
                      className="flex-1"
                    />
                    <Button
                      size="icon"
                      disabled={!addUrlInput.trim() || addUrl.isPending}
                      onClick={() => {
                        if (!addUrlInput.trim()) return;
                        addUrl.mutate({
                          videoId: id,
                          url: addUrlInput.trim(),
                          label: addUrlLabel.trim() || undefined,
                        });
                      }}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Description */}
              {video.description && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm">Description</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <pre className="text-sm text-muted-foreground whitespace-pre-wrap font-sans leading-relaxed max-h-96 overflow-auto">
                      {video.description}
                    </pre>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Right column: Workflow Info Only */}
            <div className="lg:col-span-2 space-y-6">
              {/* Associated Workflows */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-sm">
                      <Layers className="h-4 w-4" />
                      Associated Workflows
                      <Badge variant="secondary" className="ml-2">
                        {linkedWorkflows.length}
                      </Badge>
                    </CardTitle>

                    <div className="flex gap-2">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".json"
                        onChange={handleWorkflowFileChange}
                        className="hidden"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploadWorkflow.isPending}
                      >
                        {uploadWorkflow.isPending ? (
                          <>
                            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                            Uploading...
                          </>
                        ) : (
                          <>
                            <Plus className="mr-1 h-3 w-3" />
                            Add Workflow
                          </>
                        )}
                      </Button>
                      {linkedWorkflows.length > 0 && (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={true}
                          title="Coming soon"
                          onClick={() => {
                            toast.info('Rescan functionality coming soon');
                          }}
                        >
                          <RefreshCw className="mr-1 h-3 w-3" />
                          Rescan Workflows
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {linkedWorkflows.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No workflows attached. Click &quot;Add Workflow&quot; to
                      upload a ComfyUI workflow file (.json) for this video.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {linkedWorkflows.map((lw) => {
                        const isExpanded = expandedWorkflows.has(lw.workflowId);
                        const workflow = lw.workflow;
                        const deps = lw.dependencies || [];

                        return (
                          <div
                            key={lw.id}
                            className="rounded-lg border bg-card"
                          >
                            {/* Workflow Header */}
                            <div className="flex items-center justify-between px-4 py-3">
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                <button
                                  type="button"
                                  onClick={() => toggleWorkflow(lw.workflowId)}
                                  className="flex-shrink-0 hover:bg-accent rounded p-0.5"
                                >
                                  {isExpanded ? (
                                    <ChevronDown className="h-4 w-4" />
                                  ) : (
                                    <ChevronRight className="h-4 w-4" />
                                  )}
                                </button>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium text-sm truncate">
                                      {workflow?.name ||
                                        workflow?.filename ||
                                        lw.workflowId}
                                    </span>
                                    {workflow?.status && (
                                      <Badge variant="outline" className="text-xs">
                                        {workflow.status}
                                      </Badge>
                                    )}
                                  </div>
                                  {workflow && (
                                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                                      <span>{workflow.totalDependencies} dependencies</span>
                                      {workflow.resolvedLocal > 0 && (
                                        <span className="text-green-500">
                                          {workflow.resolvedLocal} local
                                        </span>
                                      )}
                                      {workflow.missingCount > 0 && (
                                        <span className="text-red-500">
                                          {workflow.missingCount} missing
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-1 flex-shrink-0">
                                {/* Only show Details if workflow is installed (not in video_workflows dir) */}
                                {workflow?.source !== 'video-uploaded' && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() =>
                                      router.push(`/workflows/${lw.workflowId}`)
                                    }
                                    className="h-8 text-xs"
                                  >
                                    Details
                                  </Button>
                                )}
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-destructive hover:text-destructive"
                                  onClick={() =>
                                    removeWorkflow.mutate({
                                      videoId: id,
                                      workflowId: lw.workflowId,
                                    })
                                  }
                                >
                                  <X className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </div>

                            {/* Workflow Dependencies (Expandable) */}
                            {isExpanded && workflow && (
                              <div className="border-t px-4 py-3 bg-muted/20">
                                <WorkflowDependencyViewer
                                  workflow={workflow}
                                  dependencies={deps}
                                  compact={true}
                                />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Tags */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <Tag className="h-4 w-4" />
                    Tags
                    <Badge variant="secondary" className="ml-2">
                      {tags.length}
                    </Badge>
                  </CardTitle>
                  <CardDescription>
                    CivitAI taxonomy tags. Auto-derived from workflows or manually added.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Model Type Tags */}
                  {modelTypeTags.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-2">
                        Model Types
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {modelTypeTags.map((tag) => (
                          <div key={tag.id} className="flex items-center gap-1">
                            <Badge
                              variant="secondary"
                              className="text-xs bg-blue-500/20 text-blue-400 border-blue-500/30"
                            >
                              {tag.value}
                              <span className="ml-1 text-[10px] opacity-60">(auto)</span>
                            </Badge>
                            <button
                              type="button"
                              onClick={() =>
                                removeTag.mutate({ videoId: id, tagId: tag.id })
                              }
                              className="hover:bg-destructive/20 rounded p-0.5"
                            >
                              <X className="h-3 w-3 text-destructive" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Base Model Tags */}
                  {baseModelTags.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-2">
                        Base Models
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {baseModelTags.map((tag) => (
                          <div key={tag.id} className="flex items-center gap-1">
                            <Badge
                              variant="secondary"
                              className="text-xs bg-purple-500/20 text-purple-400 border-purple-500/30"
                            >
                              {tag.value}
                            </Badge>
                            <button
                              type="button"
                              onClick={() =>
                                removeTag.mutate({ videoId: id, tagId: tag.id })
                              }
                              className="hover:bg-destructive/20 rounded p-0.5"
                            >
                              <X className="h-3 w-3 text-destructive" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Custom Tags */}
                  {customTags.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-2">
                        Custom
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {customTags.map((tag) => (
                          <div key={tag.id} className="flex items-center gap-1">
                            <Badge variant="secondary" className="text-xs">
                              {tag.value}
                            </Badge>
                            <button
                              type="button"
                              onClick={() =>
                                removeTag.mutate({ videoId: id, tagId: tag.id })
                              }
                              className="hover:bg-destructive/20 rounded p-0.5"
                            >
                              <X className="h-3 w-3 text-destructive" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Add Tag Form */}
                  <div className="flex gap-2">
                    <Select
                      value={addTagCategory}
                      onValueChange={setAddTagCategory}
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue placeholder="Category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={VIDEO_TAG_CATEGORIES.MODEL_TYPE}>
                          Model Type
                        </SelectItem>
                        <SelectItem value={VIDEO_TAG_CATEGORIES.BASE_MODEL}>
                          Base Model
                        </SelectItem>
                        <SelectItem value={VIDEO_TAG_CATEGORIES.CUSTOM}>
                          Custom
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={addTagValue} onValueChange={setAddTagValue}>
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Select tag..." />
                      </SelectTrigger>
                      <SelectContent>
                        {tagOptions.map((opt) => (
                          <SelectItem key={opt} value={opt}>
                            {opt}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      size="icon"
                      disabled={!addTagValue || addTag.isPending}
                      onClick={() => {
                        addTag.mutate({
                          videoId: id,
                          category: addTagCategory,
                          value: addTagValue,
                        });
                      }}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
