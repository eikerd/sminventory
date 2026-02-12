"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { trpc } from "@/lib/trpc";
import { Sidebar } from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Plus,
  Search,
  Video,
  ExternalLink,
  RefreshCw,
  Trash2,
  Eye,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import type { VideoTag } from "@/server/db/schema";

function formatRelativeTime(dateString: string | null): string {
  if (!dateString) return "—";
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays}d ago`;
  const diffMonths = Math.floor(diffDays / 30);
  return `${diffMonths}mo ago`;
}

function TagBadge({ tag }: { tag: VideoTag }) {
  const colorMap: Record<string, string> = {
    model_type: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    base_model: "bg-purple-500/20 text-purple-400 border-purple-500/30",
    custom: "bg-zinc-500/20 text-zinc-400 border-zinc-500/30",
  };
  const classes = colorMap[tag.category] || colorMap.custom;

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${classes}`}
    >
      {tag.value}
    </span>
  );
}

export default function VideosPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newUrl, setNewUrl] = useState("");

  const videosQuery = trpc.videos.list.useQuery({
    search: searchQuery || undefined,
  });
  const statsQuery = trpc.videos.stats.useQuery();

  const createVideo = trpc.videos.create.useMutation({
    onSuccess: () => {
      toast.success("Video added successfully");
      setDialogOpen(false);
      setNewUrl("");
      videosQuery.refetch();
      statsQuery.refetch();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to add video");
    },
  });

  const deleteVideo = trpc.videos.delete.useMutation({
    onSuccess: () => {
      toast.success("Video deleted");
      videosQuery.refetch();
      statsQuery.refetch();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to delete video");
    },
  });

  const handleAddVideo = () => {
    if (!newUrl.trim()) return;
    createVideo.mutate({ url: newUrl.trim() });
  };

  const videos = videosQuery.data?.videos || [];
  const total = videosQuery.data?.total || 0;

  return (
    <div className="flex h-screen bg-[#0d0d0d]">
      <Sidebar />

      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b bg-card px-6 py-4">
          <div>
            <h1 className="text-2xl font-bold">Videos</h1>
            <p className="text-sm text-muted-foreground">
              {total} video{total !== 1 ? "s" : ""} tracked
              {statsQuery.data &&
                Object.keys(statsQuery.data.byBaseModel).length > 0 &&
                ` · ${Object.keys(statsQuery.data.byBaseModel).length} base models`}
            </p>
          </div>

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Video
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Video</DialogTitle>
                <DialogDescription>
                  Paste a YouTube URL to scrape metadata and create a video record.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">YouTube URL</label>
                  <Input
                    placeholder="https://www.youtube.com/watch?v=..."
                    value={newUrl}
                    onChange={(e) => setNewUrl(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleAddVideo();
                    }}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                  disabled={createVideo.isPending}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleAddVideo}
                  disabled={!newUrl.trim() || createVideo.isPending}
                >
                  {createVideo.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Scraping...
                    </>
                  ) : (
                    <>
                      <Plus className="mr-2 h-4 w-4" />
                      Add Video
                    </>
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Search bar */}
        <div className="border-b bg-card/50 px-6 py-3">
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search videos..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Table */}
        <main className="flex-1 overflow-auto">
          {videosQuery.isLoading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : videos.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <Video className="h-12 w-12 mb-4 opacity-50" />
              <p className="text-lg font-medium">No videos yet</p>
              <p className="text-sm">
                Click &quot;Add Video&quot; to start tracking YouTube tutorials.
              </p>
            </div>
          ) : (
            <TooltipProvider>
              <table className="w-full">
                <thead className="sticky top-0 z-10 bg-card border-b">
                  <tr className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    <th className="px-6 py-3 w-20">Thumb</th>
                    <th className="px-6 py-3">Title</th>
                    <th className="px-6 py-3">Channel</th>
                    <th className="px-6 py-3">Tags</th>
                    <th className="px-6 py-3 text-center">Workflows</th>
                    <th className="px-6 py-3">Published</th>
                    <th className="px-6 py-3">Added</th>
                    <th className="px-6 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {videos.map((video) => (
                    <tr
                      key={video.id}
                      className="hover:bg-accent/50 transition-colors cursor-pointer"
                      onClick={() => router.push(`/videos/${video.id}`)}
                    >
                      {/* Thumbnail */}
                      <td className="px-6 py-3">
                        {video.thumbnailUrl ? (
                          <img
                            src={video.thumbnailUrl}
                            alt=""
                            className="w-16 h-9 rounded object-cover"
                          />
                        ) : (
                          <div className="w-16 h-9 rounded bg-muted flex items-center justify-center">
                            <Video className="h-4 w-4 text-muted-foreground" />
                          </div>
                        )}
                      </td>

                      {/* Title */}
                      <td className="px-6 py-3">
                        <div className="flex flex-col">
                          <span className="text-sm font-medium truncate max-w-xs">
                            {video.title || "Untitled"}
                          </span>
                          {video.cloudRenderUrl && (
                            <span className="text-xs text-green-400">
                              Cloud render linked
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Channel */}
                      <td className="px-6 py-3">
                        <span className="text-sm text-muted-foreground">
                          {video.channelName || "—"}
                        </span>
                      </td>

                      {/* Tags */}
                      <td className="px-6 py-3">
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {video.tags.slice(0, 4).map((tag) => (
                            <TagBadge key={tag.id} tag={tag} />
                          ))}
                          {video.tags.length > 4 && (
                            <span className="text-xs text-muted-foreground">
                              +{video.tags.length - 4}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Workflows count */}
                      <td className="px-6 py-3 text-center">
                        <Badge variant="secondary">
                          {video.workflowCount}
                        </Badge>
                      </td>

                      {/* Published */}
                      <td className="px-6 py-3">
                        <span className="text-sm text-muted-foreground">
                          {video.publishedAt
                            ? new Date(video.publishedAt).toLocaleDateString()
                            : "—"}
                        </span>
                      </td>

                      {/* Added */}
                      <td className="px-6 py-3">
                        <span className="text-sm text-muted-foreground">
                          {formatRelativeTime(video.createdAt)}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-3 text-right">
                        <div
                          className="flex items-center justify-end gap-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() =>
                                  router.push(`/videos/${video.id}`)
                                }
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>View details</TooltipContent>
                          </Tooltip>

                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() =>
                                  window.open(video.url, "_blank")
                                }
                              >
                                <ExternalLink className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Open on YouTube</TooltipContent>
                          </Tooltip>

                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:text-destructive"
                                onClick={() =>
                                  deleteVideo.mutate({ id: video.id })
                                }
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Delete</TooltipContent>
                          </Tooltip>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TooltipProvider>
          )}
        </main>
      </div>
    </div>
  );
}
