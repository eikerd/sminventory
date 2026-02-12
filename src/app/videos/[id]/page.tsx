"use client";

import { use, useState } from "react";
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
  DialogFooter,
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
} from "lucide-react";
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
  const [addWorkflowOpen, setAddWorkflowOpen] = useState(false);
  const [workflowSearch, setWorkflowSearch] = useState("");
  const [addUrlInput, setAddUrlInput] = useState("");
  const [addUrlLabel, setAddUrlLabel] = useState("");
  const [addTagCategory, setAddTagCategory] = useState<string>(
    VIDEO_TAG_CATEGORIES.MODEL_TYPE
  );
  const [addTagValue, setAddTagValue] = useState("");

  // Queries
  const videoQuery = trpc.videos.get.useQuery({ id });
  const workflowsQuery = trpc.workflows.list.useQuery(
    { search: workflowSearch || undefined },
    { enabled: addWorkflowOpen }
  );

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

  const addWorkflow = trpc.videos.addWorkflow.useMutation({
    onSuccess: () => {
      toast.success("Workflow linked");
      setAddWorkflowOpen(false);
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

  // Initialize cloud render URL from video data (only once)
  if (!cloudRenderDirty && cloudRenderUrl !== (video.cloudRenderUrl || "")) {
    setCloudRenderUrl(video.cloudRenderUrl || "");
  }

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

  // Get available workflows (not already linked)
  const linkedWorkflowIds = new Set(
    linkedWorkflows.map((lw) => lw.workflowId)
  );
  const availableWorkflows = (workflowsQuery.data?.workflows || []).filter(
    (w) => !linkedWorkflowIds.has(w.id)
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
              onClick={() => window.open(video.url, "_blank")}
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
            </div>

            {/* Right column: Workflows, Tags, URLs, Description */}
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

                    <Dialog
                      open={addWorkflowOpen}
                      onOpenChange={setAddWorkflowOpen}
                    >
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm">
                          <Plus className="mr-1 h-3 w-3" />
                          Link Workflow
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Link Workflow</DialogTitle>
                          <DialogDescription>
                            Select a workflow to associate with this video. Tags
                            will be auto-derived from its dependencies.
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-3 py-4">
                          <div className="relative">
                            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                            <Input
                              placeholder="Search workflows..."
                              value={workflowSearch}
                              onChange={(e) =>
                                setWorkflowSearch(e.target.value)
                              }
                              className="pl-10"
                            />
                          </div>
                          <div className="max-h-64 overflow-auto space-y-1">
                            {workflowsQuery.isLoading ? (
                              <div className="p-4 text-center text-sm text-muted-foreground">
                                Loading...
                              </div>
                            ) : availableWorkflows.length === 0 ? (
                              <div className="p-4 text-center text-sm text-muted-foreground">
                                No workflows found
                              </div>
                            ) : (
                              availableWorkflows.map((wf) => (
                                <button
                                  key={wf.id}
                                  className="w-full flex items-center justify-between rounded-lg px-3 py-2 text-sm hover:bg-accent text-left"
                                  onClick={() =>
                                    addWorkflow.mutate({
                                      videoId: id,
                                      workflowId: wf.id,
                                    })
                                  }
                                  disabled={addWorkflow.isPending}
                                >
                                  <div>
                                    <p className="font-medium">
                                      {wf.name || wf.filename}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                      {wf.totalDependencies} deps ·{" "}
                                      {wf.status}
                                    </p>
                                  </div>
                                  <Plus className="h-4 w-4 text-muted-foreground" />
                                </button>
                              ))
                            )}
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                </CardHeader>
                <CardContent>
                  {linkedWorkflows.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No workflows linked. Click &quot;Link Workflow&quot; to
                      associate workflows and auto-generate tags.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {linkedWorkflows.map((lw) => (
                        <div
                          key={lw.id}
                          className="flex items-center justify-between rounded-lg border px-3 py-2"
                        >
                          <button
                            className="flex-1 text-left text-sm font-medium hover:underline"
                            onClick={() =>
                              router.push(`/workflows/${lw.workflowId}`)
                            }
                          >
                            {lw.workflow?.name ||
                              lw.workflow?.filename ||
                              lw.workflowId}
                            {lw.workflow?.status && (
                              <span className="ml-2 text-xs text-muted-foreground">
                                ({lw.workflow.status})
                              </span>
                            )}
                          </button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={() =>
                              removeWorkflow.mutate({
                                videoId: id,
                                workflowId: lw.workflowId,
                              })
                            }
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
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
                    CivitAI taxonomy tags. Auto-derived from workflows or
                    manually added.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Model Types */}
                  {modelTypeTags.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">
                        Model Types
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {modelTypeTags.map((tag) => (
                          <TagBadge
                            key={tag.id}
                            category={tag.category}
                            value={tag.value}
                            source={tag.source}
                            onRemove={() =>
                              tag.id && removeTag.mutate({ tagId: tag.id })
                            }
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Base Models */}
                  {baseModelTags.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">
                        Base Models
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {baseModelTags.map((tag) => (
                          <TagBadge
                            key={tag.id}
                            category={tag.category}
                            value={tag.value}
                            source={tag.source}
                            onRemove={() =>
                              tag.id && removeTag.mutate({ tagId: tag.id })
                            }
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Custom Tags */}
                  {customTags.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">
                        Custom
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {customTags.map((tag) => (
                          <TagBadge
                            key={tag.id}
                            category={tag.category}
                            value={tag.value}
                            source={tag.source}
                            onRemove={() =>
                              tag.id && removeTag.mutate({ tagId: tag.id })
                            }
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {tags.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      No tags yet. Link a workflow to auto-generate tags, or add
                      manually below.
                    </p>
                  )}

                  {/* Add tag */}
                  <div className="flex items-center gap-2 pt-2 border-t">
                    <Select
                      value={addTagCategory}
                      onValueChange={setAddTagCategory}
                    >
                      <SelectTrigger className="w-36">
                        <SelectValue />
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

                    {addTagCategory === VIDEO_TAG_CATEGORIES.CUSTOM ? (
                      <Input
                        placeholder="Custom tag value"
                        value={addTagValue}
                        onChange={(e) => setAddTagValue(e.target.value)}
                        className="flex-1"
                      />
                    ) : (
                      <Select
                        value={addTagValue}
                        onValueChange={setAddTagValue}
                      >
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder="Select tag..." />
                        </SelectTrigger>
                        <SelectContent>
                          {availableTagOptions.map((opt) => (
                            <SelectItem key={opt} value={opt}>
                              {opt}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}

                    <Button
                      size="sm"
                      disabled={!addTagValue || addTag.isPending}
                      onClick={() =>
                        addTag.mutate({
                          videoId: id,
                          category: addTagCategory,
                          value: addTagValue,
                        })
                      }
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>

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
                              className="text-sm text-blue-400 hover:underline truncate block"
                            >
                              {u.label || u.url}
                            </a>
                            {u.label && (
                              <p className="text-xs text-muted-foreground truncate">
                                {u.url}
                              </p>
                            )}
                            <span className="text-[10px] text-muted-foreground">
                              {u.source === "scraped"
                                ? "from description"
                                : "manual"}
                            </span>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:text-destructive shrink-0"
                            onClick={() => removeUrl.mutate({ urlId: u.id! })}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add URL */}
                  <div className="flex items-center gap-2 pt-2 border-t">
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
                      className="w-40"
                    />
                    <Button
                      size="sm"
                      disabled={!addUrlInput.trim() || addUrl.isPending}
                      onClick={() =>
                        addUrl.mutate({
                          videoId: id,
                          url: addUrlInput.trim(),
                          label: addUrlLabel.trim() || undefined,
                        })
                      }
                    >
                      <Plus className="h-3 w-3" />
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
          </div>
        </main>
      </div>
    </div>
  );
}
