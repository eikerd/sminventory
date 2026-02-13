"use client";

import { use, useState, useEffect, useRef, useCallback } from "react";
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
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { WorkflowDependencyTree } from "@/components/workflow-dependency-tree";
import { ScanConsole } from "@/components/scan-console";
import { toast } from "sonner";
import {
  VIDEO_TAG_CATEGORIES,
  MODEL_TYPES,
  BASE_MODELS,
} from "@/lib/config";
import type { ScanEvent } from "@/types/scan-events";

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
  const [addTagCategory, setAddTagCategory] = useState(
    VIDEO_TAG_CATEGORIES.MODEL_TYPE as typeof VIDEO_TAG_CATEGORIES[keyof typeof VIDEO_TAG_CATEGORIES]
  );
  const [addTagValue, setAddTagValue] = useState("");
  const [videoExpanded, setVideoExpanded] = useState(false);
  // Scan console state
  const [scanEvents, setScanEvents] = useState<ScanEvent[]>([]);
  const [scanActive, setScanActive] = useState(false);
  const [highlightedModel, setHighlightedModel] = useState<string | undefined>();
  const [showConsole, setShowConsole] = useState(false);
  // File input ref for workflow upload
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Refs for timeout cleanup
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const mountedRef = useRef(true);

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

  const rescanWorkflowsVerbose = trpc.videos.rescanWorkflowsVerbose.useMutation({
    onSuccess: (data) => {
      playScanEvents(data.events);
    },
    onError: (e) => {
      setScanActive(false);
      toast.error(e.message);
    },
  });

  // Handle workflow file upload
  const handleWorkflowFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file extension
    if (!file.name.endsWith('.json')) {
      toast.error('Please select a .json workflow file');
      // Clear file input to allow re-selection
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
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
        // Clear file input to allow re-selection
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
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
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    };

    reader.readAsText(file);
  };

  // Cleanup timeouts on unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      for (const t of timeoutsRef.current) clearTimeout(t);
      timeoutsRef.current = [];
    };
  }, []);

  // Play scan events sequentially with delays
  const playScanEvents = useCallback((events: ScanEvent[]) => {
    // Clear any previous timeouts
    for (const t of timeoutsRef.current) clearTimeout(t);
    timeoutsRef.current = [];

    let delay = 0;
    for (let i = 0; i < events.length; i++) {
      const event = events[i];
      // Variable delay based on phase
      const stepDelay =
        event.phase === "start" || event.phase === "complete" ? 400
        : event.phase === "check" ? 300
        : event.phase === "vram" ? 200
        : 250;

      delay += stepDelay;

      const tid = setTimeout(() => {
        if (!mountedRef.current) return;
        setScanEvents((prev) => [...prev, event]);

        // Highlight model if it's a check/vram event with modelName
        if (event.modelName) {
          setHighlightedModel(event.modelName);
        }

        // If last event, finish playback
        if (i === events.length - 1) {
          const finishTid = setTimeout(() => {
            if (!mountedRef.current) return;
            setScanActive(false);
            setHighlightedModel(undefined);
            videoQuery.refetch();
            toast.success("Rescan complete");
          }, 800);
          timeoutsRef.current.push(finishTid);
        }
      }, delay);

      timeoutsRef.current.push(tid);
    }
  }, [videoQuery]);

  // Start verbose rescan
  const handleRescan = useCallback(() => {
    setScanEvents([]);
    setScanActive(true);
    setShowConsole(true);
    setHighlightedModel(undefined);
    rescanWorkflowsVerbose.mutate({ videoId: id });
  }, [rescanWorkflowsVerbose, id]);

  // Load persisted scan events from DB on initial load
  const persistedEventsLoaded = useRef(false);
  useEffect(() => {
    if (videoQuery.data?.video && !persistedEventsLoaded.current && !scanActive) {
      persistedEventsLoaded.current = true;
      const raw = videoQuery.data.video.lastScanEvents;
      if (raw) {
        try {
          const parsed = JSON.parse(raw) as ScanEvent[];
          if (parsed.length > 0) {
            setScanEvents(parsed);
            setShowConsole(true);
          }
        } catch {
          // Ignore invalid JSON
        }
      }
    }
  }, [videoQuery.data?.video, scanActive]);

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
        <main className="flex-1 overflow-auto p-6 space-y-4">
          {/* Collapsible Video Info Card */}
          <Card>
            <button
              type="button"
              onClick={() => setVideoExpanded(!videoExpanded)}
              className="w-full text-left"
              aria-label={videoExpanded ? "Collapse video details" : "Expand video details"}
              aria-expanded={videoExpanded}
            >
              <div className="flex items-center gap-3 px-4 py-3">
                {/* Small thumbnail */}
                {video.thumbnailUrl ? (
                  <img
                    src={video.thumbnailUrl}
                    alt={video.title || ""}
                    className="h-16 w-auto rounded object-cover flex-shrink-0"
                  />
                ) : (
                  <div className="h-16 w-28 rounded bg-muted flex items-center justify-center flex-shrink-0">
                    <Video className="h-6 w-6 text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="font-medium text-sm truncate">
                      {video.title || "Untitled Video"}
                    </h2>
                    {videoExpanded ? (
                      <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    )}
                  </div>
                  {!videoExpanded && (
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                      {video.description || "No description"}
                    </p>
                  )}
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                    <span>{video.channelName || "Unknown channel"}</span>
                    {video.publishedAt && (
                      <span>{new Date(video.publishedAt).toLocaleDateString()}</span>
                    )}
                    {video.duration && <span>{video.duration}</span>}
                  </div>
                </div>
              </div>
            </button>

            {/* Expanded video details */}
            {videoExpanded && (
              <div className="border-t px-4 py-4 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {/* Full Thumbnail + Description */}
                  <div className="space-y-4">
                    {video.thumbnailUrl && (
                      <img
                        src={video.thumbnailUrl}
                        alt={video.title || ""}
                        className="w-full rounded-lg object-cover"
                      />
                    )}
                    {video.description && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">Description</p>
                        <pre className="text-sm text-muted-foreground whitespace-pre-wrap font-sans leading-relaxed max-h-64 overflow-auto">
                          {video.description}
                        </pre>
                      </div>
                    )}
                  </div>

                  {/* Stats, Status, Technical */}
                  <div className="space-y-4">
                    {/* Statistics */}
                    {(video.viewCount !== null || video.likeCount !== null || video.commentCount !== null) && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-2">Statistics</p>
                        <div className="space-y-1">
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
                        </div>
                      </div>
                    )}

                    {/* Video Status */}
                    {(video.privacyStatus || video.license || video.uploadStatus) && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-2">Status</p>
                        <div className="space-y-1 text-sm">
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
                        </div>
                      </div>
                    )}

                    {/* Technical Details */}
                    {(video.definition || video.dimension || video.projection || video.caption !== null) && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-2">Technical</p>
                        <div className="space-y-1 text-sm">
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
                        </div>
                      </div>
                    )}

                    {/* Recording Details */}
                    {(video.recordingDate || video.locationDescription) && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-2">Recording</p>
                        <div className="space-y-1 text-sm">
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
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Cloud Render, URLs, Tags */}
                  <div className="space-y-4">
                    {/* Cloud Render URL */}
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                        <Cloud className="h-3 w-3" /> Cloud Render URL
                      </p>
                      <div className="flex gap-2">
                        <Input
                          placeholder="https://runpod.io/..."
                          value={cloudRenderUrl}
                          onChange={(e) => {
                            setCloudRenderUrl(e.target.value);
                            setCloudRenderDirty(true);
                          }}
                          className="text-sm"
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
                    </div>

                    {/* URLs */}
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                        <Link2 className="h-3 w-3" /> URLs ({urls.length})
                      </p>
                      {urls.length > 0 && (
                        <div className="space-y-1 mb-2">
                          {urls.map((u) => (
                            <div
                              key={u.id}
                              className="flex items-center justify-between rounded border px-2 py-1.5"
                            >
                              <a
                                href={u.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-primary hover:underline truncate flex-1"
                              >
                                {u.label || u.url}
                              </a>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-destructive hover:text-destructive flex-shrink-0"
                                onClick={() => removeUrl.mutate({ urlId: u.id })}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="flex gap-1.5">
                        <Input
                          placeholder="URL"
                          value={addUrlInput}
                          onChange={(e) => setAddUrlInput(e.target.value)}
                          className="flex-1 text-xs h-8"
                        />
                        <Input
                          placeholder="Label"
                          value={addUrlLabel}
                          onChange={(e) => setAddUrlLabel(e.target.value)}
                          className="w-24 text-xs h-8"
                        />
                        <Button
                          size="icon"
                          className="h-8 w-8"
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
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>

                    {/* Tags */}
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                        <Tag className="h-3 w-3" /> Tags ({tags.length})
                      </p>
                      <div className="space-y-2">
                        {modelTypeTags.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {modelTypeTags.map((tag) => (
                              <div key={tag.id} className="flex items-center gap-0.5">
                                <Badge variant="secondary" className="text-[10px] bg-blue-500/20 text-blue-400 border-blue-500/30 px-1.5 py-0">
                                  {tag.value}
                                </Badge>
                                <button type="button" onClick={() => removeTag.mutate({ tagId: tag.id })} className="hover:bg-destructive/20 rounded p-0.5">
                                  <X className="h-2.5 w-2.5 text-destructive" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                        {baseModelTags.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {baseModelTags.map((tag) => (
                              <div key={tag.id} className="flex items-center gap-0.5">
                                <Badge variant="secondary" className="text-[10px] bg-purple-500/20 text-purple-400 border-purple-500/30 px-1.5 py-0">
                                  {tag.value}
                                </Badge>
                                <button type="button" onClick={() => removeTag.mutate({ tagId: tag.id })} className="hover:bg-destructive/20 rounded p-0.5">
                                  <X className="h-2.5 w-2.5 text-destructive" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                        {customTags.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {customTags.map((tag) => (
                              <div key={tag.id} className="flex items-center gap-0.5">
                                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                                  {tag.value}
                                </Badge>
                                <button type="button" onClick={() => removeTag.mutate({ tagId: tag.id })} className="hover:bg-destructive/20 rounded p-0.5">
                                  <X className="h-2.5 w-2.5 text-destructive" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                        <div className="flex gap-1.5">
                          <Select value={addTagCategory} onValueChange={(v) => setAddTagCategory(v as typeof addTagCategory)}>
                            <SelectTrigger className="w-24 text-xs h-8">
                              <SelectValue placeholder="Category" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value={VIDEO_TAG_CATEGORIES.MODEL_TYPE}>Model Type</SelectItem>
                              <SelectItem value={VIDEO_TAG_CATEGORIES.BASE_MODEL}>Base Model</SelectItem>
                              <SelectItem value={VIDEO_TAG_CATEGORIES.CUSTOM}>Custom</SelectItem>
                            </SelectContent>
                          </Select>
                          {addTagCategory === VIDEO_TAG_CATEGORIES.CUSTOM ? (
                            <Input className="flex-1 text-xs h-8" placeholder="Custom tag..." value={addTagValue} onChange={(e) => setAddTagValue(e.target.value)} />
                          ) : (
                            <Select value={addTagValue} onValueChange={setAddTagValue}>
                              <SelectTrigger className="flex-1 text-xs h-8">
                                <SelectValue placeholder="Select..." />
                              </SelectTrigger>
                              <SelectContent>
                                {availableTagOptions.map((opt) => (
                                  <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          )}
                          <Button
                            size="icon"
                            className="h-8 w-8"
                            disabled={!addTagValue.trim() || addTag.isPending}
                            onClick={() => {
                              addTag.mutate({ videoId: id, category: addTagCategory, value: addTagValue });
                            }}
                          >
                            <Plus className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </Card>

          {/* Workflow Dependencies - Full Width */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Layers className="h-4 w-4" />
                  Workflow Dependencies
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
                      disabled={scanActive || rescanWorkflowsVerbose.isPending}
                      onClick={handleRescan}
                    >
                      {scanActive || rescanWorkflowsVerbose.isPending ? (
                        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                      ) : (
                        <RefreshCw className="mr-1 h-3 w-3" />
                      )}
                      Rescan
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
                <div className="space-y-4">
                  {linkedWorkflows.map((lw) => {
                    const workflow = lw.workflow;

                    return (
                      <div key={lw.id}>
                        {/* Workflow name with remove button */}
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-sm truncate">
                            {workflow?.name || workflow?.filename || lw.workflowId}
                          </span>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            {workflow?.source !== 'video-uploaded' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => router.push(`/workflows/${lw.workflowId}`)}
                                className="h-7 text-xs"
                              >
                                Details
                              </Button>
                            )}
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
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                        {/* Full dependency tree - always visible, full width */}
                        <WorkflowDependencyTree workflowId={lw.workflowId} highlightedModel={highlightedModel} />
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Scan Console - always visible when events exist */}
          {(showConsole || scanEvents.length > 0) && (
            <ScanConsole
              events={scanEvents}
              active={scanActive}
            />
          )}
        </main>
      </div>
    </div>
  );
}
