"use client";

import { useState, useMemo, useEffect, useRef, Suspense, Fragment } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { logger } from "@/lib/logger";
import { ErrorHandler } from "@/lib/error-handler";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Search,
  RefreshCw,
  Eye,
  Download,
  ChevronDown,
  ChevronRight,
  Film,
  Image,
  Wand2,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  Star,
} from "lucide-react";
import { WORKFLOW_STATUS } from "@/lib/config";
import { cn } from "@/lib/utils";

type FilterType = "all" | "missing" | "not-scanned" | "ready";

// Health status component with colored dot
function HealthDot({ status, missing }: { status: string | null; missing: number }) {
  let color = "bg-gray-400"; // Unknown/not scanned
  let label = "Not scanned";

  if (status === WORKFLOW_STATUS.SCANNED_READY_LOCAL || status === WORKFLOW_STATUS.SCANNED_READY_CLOUD) {
    color = "bg-emerald-500";
    label = "Ready to run";
  } else if (status === WORKFLOW_STATUS.SCANNED_MISSING || missing > 0) {
    color = "bg-amber-500";
    label = `${missing} model${missing !== 1 ? "s" : ""} missing`;
  } else if (status === WORKFLOW_STATUS.SCANNED_ERROR) {
    color = "bg-red-500";
    label = "Scan error";
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger>
          <div className={cn("w-3 h-3 rounded-full", color)} />
        </TooltipTrigger>
        <TooltipContent>
          <p>{label}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// Workflow type icon based on name heuristics
function WorkflowTypeIcon({ name }: { name: string }) {
  const lowerName = name.toLowerCase();
  if (lowerName.includes("video") || lowerName.includes("animate") || lowerName.includes("wan")) {
    return <Film className="h-4 w-4 text-purple-400" aria-label="Video workflow" />;
  }
  if (lowerName.includes("upscale") || lowerName.includes("tile")) {
    return <Wand2 className="h-4 w-4 text-blue-400" aria-label="Upscaling workflow" />;
  }
  return <Image className="h-4 w-4 text-gray-400" aria-label="Image workflow" />;
}

// Format bytes to human readable
function formatSize(bytes: number | null): string {
  if (!bytes || bytes === 0) return "--";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let unitIndex = 0;
  let size = bytes;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }
  return `${size.toFixed(size < 10 ? 1 : 0)} ${units[unitIndex]}`;
}

// Format relative time
function formatRelativeTime(dateStr: string | null): string {
  if (!dateStr) return "Never";
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

function WorkflowsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectedRef = useRef(false);

  // Redirect to ?view=table if no view param is present
  useEffect(() => {
    if (!searchParams.get("view") && !redirectedRef.current) {
      redirectedRef.current = true;
      const defaultView = typeof localStorage !== "undefined" ? localStorage.getItem("defaultWorkflowView") || "table" : "table";
      router.push(`/workflows?view=${defaultView}`);
    }
  }, [searchParams, router]);

  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<FilterType>("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(new Set());
  const [sortKey, setSortKey] = useState<string | null>("scannedAt");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  // Load pinned workflows from localStorage
  useEffect(() => {
    if (typeof localStorage !== "undefined") {
      const saved = localStorage.getItem("pinnedWorkflows");
      if (saved) {
        try {
          setPinnedIds(new Set(JSON.parse(saved)));
        } catch (e) {
          // Ignore parse errors
        }
      }
    }
  }, []);

  const savePinnedWorkflows = (ids: Set<string>) => {
    setPinnedIds(ids);
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("pinnedWorkflows", JSON.stringify([...ids]));
    }
  };

  const togglePin = (id: string) => {
    const newSet = new Set(pinnedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    savePinnedWorkflows(newSet);
  };

  const workflowsQuery = trpc.workflows.list.useQuery({
    search: searchQuery || undefined,
    status: activeFilter === "missing" ? WORKFLOW_STATUS.SCANNED_MISSING :
            activeFilter === "not-scanned" ? WORKFLOW_STATUS.NEW :
            activeFilter === "ready" ? WORKFLOW_STATUS.SCANNED_READY_LOCAL :
            undefined,
  });

  const workflowStats = trpc.workflows.stats.useQuery();

  const scanWorkflows = trpc.workflows.scan.useMutation({
    onSuccess: () => {
      logger.info("Workflows scanned successfully");
      workflowsQuery.refetch();
      workflowStats.refetch();
      toast.success("✓ Workflows scanned successfully");
    },
    onError: (error) => {
      ErrorHandler.handleScanError(error);
    },
  });

  const resolveAll = trpc.workflows.resolveAll.useMutation({
    onSuccess: () => {
      logger.info("All dependencies resolved and queued for download");
      workflowsQuery.refetch();
      workflowStats.refetch();
      toast.success("✓ Dependencies resolved and queued for download");
    },
    onError: (error) => {
      ErrorHandler.handleWorkflowError(error, "all");
    },
  });

  const resolveDeps = trpc.workflows.resolveDependencies.useMutation({
    onSuccess: () => {
      logger.info("Dependencies resolved for workflow");
      workflowsQuery.refetch();
      toast.success("✓ Dependencies resolved");
    },
    onError: (error) => {
      ErrorHandler.handleWorkflowError(error, "resolveDeps");
    },
  });

  const workflows = workflowsQuery.data?.workflows || [];

  // Selection handlers
  const toggleSelectAll = () => {
    if (selectedIds.size === workflows.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(workflows.map((w) => w.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const toggleExpand = (id: string) => {
    const newSet = new Set(expandedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setExpandedIds(newSet);
  };

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDirection("asc");
    }
  };

  const getSortIcon = (key: string) => {
    if (sortKey !== key) {
      return <ArrowUpDown className="h-3 w-3 ml-1 inline opacity-40" />;
    }
    return sortDirection === "asc" ? (
      <ArrowUp className="h-3 w-3 ml-1 inline" />
    ) : (
      <ArrowDown className="h-3 w-3 ml-1 inline" />
    );
  };

  // Filter counts
  const missingCount = workflows.filter(
    (w) => w.status === WORKFLOW_STATUS.SCANNED_MISSING || (w.missingCount || 0) > 0
  ).length;
  const notScannedCount = workflows.filter((w) => w.status === WORKFLOW_STATUS.NEW).length;
  const readyCount = workflows.filter(
    (w) => w.status === WORKFLOW_STATUS.SCANNED_READY_LOCAL || w.status === WORKFLOW_STATUS.SCANNED_READY_CLOUD
  ).length;

  // Sort workflows
  const sortedWorkflows = useMemo(() => {
    if (!sortKey || workflows.length === 0) return workflows;

    return [...workflows].sort((a, b) => {
      const aVal = a[sortKey as keyof typeof a];
      const bVal = b[sortKey as keyof typeof b];

      // Handle null/undefined
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return sortDirection === "asc" ? 1 : -1;
      if (bVal == null) return sortDirection === "asc" ? -1 : 1;

      // Numeric comparison
      if (typeof aVal === "number" && typeof bVal === "number") {
        return sortDirection === "asc" ? aVal - bVal : bVal - aVal;
      }

      // Date comparison
      if (typeof aVal === "string" || typeof bVal === "string") {
        const aDate = typeof aVal === "string" ? new Date(aVal) : new Date(String(aVal));
        const bDate = typeof bVal === "string" ? new Date(bVal) : new Date(String(bVal));
        const diff = aDate.getTime() - bDate.getTime();
        return sortDirection === "asc" ? diff : -diff;
      }

      // String comparison
      const aStr = String(aVal).toLowerCase();
      const bStr = String(bVal).toLowerCase();
      return sortDirection === "asc" ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr);
    });
  }, [workflows, sortKey, sortDirection]);

  return (
    <div className="flex h-screen bg-[#0d0d0d]">
      <Sidebar />

      <div className="flex flex-1 flex-col overflow-hidden">
        <Header
          title="Workflows"
          description="Manage and scan ComfyUI workflows"
          onScan={() => scanWorkflows.mutate()}
          scanning={scanWorkflows.isPending}
          scanLabel="Scan Workflow Folder"
        />

        <main className="flex-1 overflow-hidden flex flex-col">
          {/* Filter Bar */}
          <div className="flex items-center gap-4 px-6 py-4 border-b border-gray-800">
            {/* Search */}
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
              <Input
                placeholder="Search workflows..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-[#1a1a1a] border-gray-700 focus:border-purple-500"
              />
            </div>

            {/* Quick Filters */}
            <div className="flex gap-2">
              <Button
                variant={activeFilter === "all" ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveFilter("all")}
                className={cn(
                  "rounded-full",
                  activeFilter === "all" && "bg-purple-600 hover:bg-purple-700"
                )}
              >
                All ({workflows.length})
              </Button>
              <Button
                variant={activeFilter === "missing" ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveFilter("missing")}
                className={cn(
                  "rounded-full",
                  activeFilter === "missing" && "bg-amber-600 hover:bg-amber-700"
                )}
              >
                Missing Models ({missingCount})
              </Button>
              <Button
                variant={activeFilter === "not-scanned" ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveFilter("not-scanned")}
                className={cn(
                  "rounded-full",
                  activeFilter === "not-scanned" && "bg-gray-600 hover:bg-gray-700"
                )}
              >
                Not Scanned ({notScannedCount})
              </Button>
              <Button
                variant={activeFilter === "ready" ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveFilter("ready")}
                className={cn(
                  "rounded-full",
                  activeFilter === "ready" && "bg-emerald-600 hover:bg-emerald-700"
                )}
              >
                Ready ({readyCount})
              </Button>
            </div>

            {/* Global Actions */}
            <div className="flex gap-2 ml-auto">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (selectedIds.size > 0) {
                    selectedIds.forEach((id) => {
                      scanWorkflows.mutate();
                    });
                  } else {
                    scanWorkflows.mutate();
                  }
                }}
                disabled={scanWorkflows.isPending}
              >
                {scanWorkflows.isPending ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                Scan Selected
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => resolveAll.mutate()}
                disabled={resolveAll.isPending}
              >
                <Download className="h-4 w-4 mr-2" />
                Download Missing
              </Button>
            </div>
          </div>

          {/* Table Container with Sticky Header */}
          <div className="flex-1 overflow-auto">
            {workflowsQuery.isLoading ? (
              <div className="p-6 space-y-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="flex gap-4 items-center">
                    <Skeleton className="h-4 w-4" />
                    <Skeleton className="h-4 flex-1" />
                    <Skeleton className="h-4 w-8" />
                    <Skeleton className="h-2 w-32" />
                    <Skeleton className="h-4 w-12" />
                    <Skeleton className="h-4 w-16" />
                    <Skeleton className="h-4 w-20" />
                  </div>
                ))}
              </div>
            ) : workflows.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-500">
                <p className="text-lg">No workflows found</p>
                <p className="text-sm mt-2">Click &quot;Scan Selected&quot; to discover workflows</p>
              </div>
            ) : (
              <>
                {/* Pinned Workflows Section */}
                {pinnedIds.size > 0 && (
                  <div className="border-b border-gray-800">
                    <div className="px-6 py-3 bg-[#111] sticky top-0">
                      <h3 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
                        <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                        Pinned Workflows
                      </h3>
                    </div>
                    <Table>
                      <TableHeader className="bg-[#0d0d0d]">
                        <TableRow className="border-gray-800 hover:bg-transparent">
                          <TableHead className="w-10">
                            <Checkbox
                              checked={pinnedIds.size > 0 && [...pinnedIds].every((id) => selectedIds.has(id))}
                              onCheckedChange={() => {
                                const newSet = new Set(selectedIds);
                                [...pinnedIds].forEach((id) => {
                                  if (newSet.has(id)) {
                                    newSet.delete(id);
                                  } else {
                                    newSet.add(id);
                                  }
                                });
                                setSelectedIds(newSet);
                              }}
                            />
                          </TableHead>
                          <TableHead className="w-[35%]">Workflow Name</TableHead>
                          <TableHead className="w-10 text-center">Health</TableHead>
                          <TableHead className="w-[180px]">Dependencies</TableHead>
                          <TableHead className="w-20 text-center">Missing</TableHead>
                          <TableHead className="w-24 text-right font-mono">Size</TableHead>
                          <TableHead className="w-28">Last Scanned</TableHead>
                          <TableHead className="w-28 text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sortedWorkflows
                          .filter((w) => pinnedIds.has(w.id))
                          .map((workflow) => {
                          const total = workflow.totalDependencies || 0;
                          const resolved = (workflow.resolvedLocal || 0) + (workflow.resolvedWarehouse || 0);
                          const missing = workflow.missingCount || 0;
                          const progress = total > 0 ? (resolved / total) * 100 : 0;
                          const isExpanded = expandedIds.has(workflow.id);
                          const hasMissing = missing > 0;
                          const isReady = workflow.status === WORKFLOW_STATUS.SCANNED_READY_LOCAL ||
                                         workflow.status === WORKFLOW_STATUS.SCANNED_READY_CLOUD;

                          return (
                            <>
                              <TableRow
                                key={workflow.id}
                                className={cn(
                                  "border-gray-800/50 transition-colors",
                                  "hover:bg-purple-900/10 hover:shadow-[0_0_15px_rgba(168,85,247,0.1)]",
                                  hasMissing && "text-amber-200/90",
                                  isReady && "text-white"
                                )}
                              >
                                <TableCell>
                                  <Checkbox
                                    checked={selectedIds.has(workflow.id)}
                                    onCheckedChange={() => toggleSelect(workflow.id)}
                                  />
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-3">
                                    <button
                                      onClick={() => toggleExpand(workflow.id)}
                                      className="text-gray-500 hover:text-white transition-colors"
                                    >
                                      {isExpanded ? (
                                        <ChevronDown className="h-4 w-4" />
                                      ) : (
                                        <ChevronRight className="h-4 w-4" />
                                      )}
                                    </button>
                                    <WorkflowTypeIcon name={workflow.name || workflow.filename} />
                                    <button
                                      onClick={() => router.push(`/workflows/${workflow.id}`)}
                                      className="font-medium truncate max-w-[300px] hover:text-purple-400 transition-colors text-left"
                                    >
                                      {workflow.name || workflow.filename}
                                    </button>
                                  </div>
                                </TableCell>
                                <TableCell className="text-center">
                                  <HealthDot status={workflow.status} missing={missing} />
                                </TableCell>
                                <TableCell>
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger className="w-full">
                                        <div className="flex items-center gap-2">
                                          <Progress
                                            value={progress}
                                            className={cn(
                                              "h-1.5 flex-1",
                                              progress === 100 ? "bg-emerald-900/30" : "bg-gray-800"
                                            )}
                                          />
                                          <span className="text-xs text-gray-500 font-mono w-12 text-right">
                                            {resolved}/{total}
                                          </span>
                                        </div>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p>{resolved} of {total} models found</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                </TableCell>
                                <TableCell className="text-center">
                                  {missing > 0 ? (
                                    <Badge
                                      variant="outline"
                                      className="bg-amber-500/20 text-amber-400 border-amber-500/50 font-mono"
                                    >
                                      ! {missing}
                                    </Badge>
                                  ) : (
                                    <span className="text-gray-600">--</span>
                                  )}
                                </TableCell>
                                <TableCell className="text-right font-mono text-gray-400">
                                  {formatSize(workflow.totalSizeBytes)}
                                </TableCell>
                                <TableCell className="text-gray-500 text-sm">
                                  {formatRelativeTime(workflow.scannedAt)}
                                </TableCell>
                                <TableCell>
                                  <div className="flex justify-end gap-1 opacity-50 hover:opacity-100 transition-opacity">
                                    <TooltipProvider>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8"
                                            onClick={() => togglePin(workflow.id)}
                                          >
                                            <Star className={`h-4 w-4 ${pinnedIds.has(workflow.id) ? "fill-yellow-400 text-yellow-400" : ""}`} />
                                          </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>{pinnedIds.has(workflow.id) ? "Unpin" : "Pin"}</TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                    <TooltipProvider>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8"
                                            onClick={() => (window.location.href = `/workflows/${workflow.id}`)}
                                          >
                                            <Eye className="h-4 w-4" />
                                          </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>View details</TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                    <TooltipProvider>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8"
                                            onClick={() => resolveDeps.mutate({ id: workflow.id })}
                                          >
                                            <RefreshCw className="h-4 w-4" />
                                          </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>Rescan</TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                    <TooltipProvider>
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8"
                                            disabled={missing === 0}
                                          >
                                            <Download className="h-4 w-4" />
                                          </Button>
                                        </TooltipTrigger>
                                        <TooltipContent>Download missing</TooltipContent>
                                      </Tooltip>
                                    </TooltipProvider>
                                  </div>
                                </TableCell>
                              </TableRow>

                              {/* Expandable Row */}
                              {isExpanded && (
                                <TableRow key={`${workflow.id}-expand-pinned`} className="bg-[#111] border-gray-800/30">
                                  <TableCell colSpan={8} className="py-4 px-12">
                                    <div className="text-sm text-gray-400">
                                      <p className="font-medium text-gray-300 mb-2">Required Models:</p>
                                      <p className="text-gray-500 italic">
                                        Loading dependencies... (View details for full list)
                                      </p>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              )}
                            </>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}

                {/* All Workflows Section */}
                <Table>
                  <TableHeader className="sticky top-0 bg-[#0d0d0d] z-10">
                    <TableRow className="border-gray-800 hover:bg-transparent">
                      <TableHead className="w-10">
                        <Checkbox
                          checked={selectedIds.size === workflows.length && workflows.length > 0}
                          onCheckedChange={toggleSelectAll}
                        />
                      </TableHead>
                      <TableHead
                        className="w-[35%] cursor-pointer select-none hover:bg-gray-800/50"
                        onClick={() => handleSort("name")}
                      >
                        Workflow Name {getSortIcon("name")}
                      </TableHead>
                      <TableHead className="w-10 text-center">Health</TableHead>
                      <TableHead
                        className="w-[180px] cursor-pointer select-none hover:bg-gray-800/50"
                        onClick={() => handleSort("totalDependencies")}
                      >
                        Dependencies {getSortIcon("totalDependencies")}
                      </TableHead>
                      <TableHead
                        className="w-20 text-center cursor-pointer select-none hover:bg-gray-800/50"
                        onClick={() => handleSort("missingCount")}
                      >
                        Missing {getSortIcon("missingCount")}
                      </TableHead>
                      <TableHead
                        className="w-24 text-right font-mono cursor-pointer select-none hover:bg-gray-800/50"
                        onClick={() => handleSort("totalSizeBytes")}
                      >
                        Size {getSortIcon("totalSizeBytes")}
                      </TableHead>
                      <TableHead
                        className="w-28 cursor-pointer select-none hover:bg-gray-800/50"
                        onClick={() => handleSort("scannedAt")}
                      >
                        Last Scanned {getSortIcon("scannedAt")}
                      </TableHead>
                      <TableHead className="w-28 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedWorkflows
                      .filter((w) => !pinnedIds.has(w.id))
                      .map((workflow) => {
                    const total = workflow.totalDependencies || 0;
                    const resolved = (workflow.resolvedLocal || 0) + (workflow.resolvedWarehouse || 0);
                    const missing = workflow.missingCount || 0;
                    const progress = total > 0 ? (resolved / total) * 100 : 0;
                    const isExpanded = expandedIds.has(workflow.id);
                    const hasMissing = missing > 0;
                    const isReady = workflow.status === WORKFLOW_STATUS.SCANNED_READY_LOCAL ||
                                   workflow.status === WORKFLOW_STATUS.SCANNED_READY_CLOUD;

                    return (
                      <Fragment key={workflow.id}>
                        <TableRow
                          className={cn(
                            "border-gray-800/50 transition-colors",
                            "hover:bg-purple-900/10 hover:shadow-[0_0_15px_rgba(168,85,247,0.1)]",
                            hasMissing && "text-amber-200/90",
                            isReady && "text-white"
                          )}
                        >
                          <TableCell>
                            <Checkbox
                              checked={selectedIds.has(workflow.id)}
                              onCheckedChange={() => toggleSelect(workflow.id)}
                            />
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <button
                                onClick={() => toggleExpand(workflow.id)}
                                className="text-gray-500 hover:text-white transition-colors"
                              >
                                {isExpanded ? (
                                  <ChevronDown className="h-4 w-4" />
                                ) : (
                                  <ChevronRight className="h-4 w-4" />
                                )}
                              </button>
                              <WorkflowTypeIcon name={workflow.name || workflow.filename} />
                              <button
                                onClick={() => router.push(`/workflows/${workflow.id}`)}
                                className="font-medium truncate max-w-[300px] hover:text-purple-400 transition-colors text-left"
                              >
                                {workflow.name || workflow.filename}
                              </button>
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <HealthDot status={workflow.status} missing={missing} />
                          </TableCell>
                          <TableCell>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger className="w-full">
                                  <div className="flex items-center gap-2">
                                    <Progress
                                      value={progress}
                                      className={cn(
                                        "h-1.5 flex-1",
                                        progress === 100 ? "bg-emerald-900/30" : "bg-gray-800"
                                      )}
                                    />
                                    <span className="text-xs text-gray-500 font-mono w-12 text-right">
                                      {resolved}/{total}
                                    </span>
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>{resolved} of {total} models found</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </TableCell>
                          <TableCell className="text-center">
                            {missing > 0 ? (
                              <Badge
                                variant="outline"
                                className="bg-amber-500/20 text-amber-400 border-amber-500/50 font-mono"
                              >
                                ! {missing}
                              </Badge>
                            ) : (
                              <span className="text-gray-600">--</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-mono text-gray-400">
                            {formatSize(workflow.totalSizeBytes)}
                          </TableCell>
                          <TableCell className="text-gray-500 text-sm">
                            {formatRelativeTime(workflow.scannedAt)}
                          </TableCell>
                          <TableCell>
                            <div className="flex justify-end gap-1 opacity-50 hover:opacity-100 transition-opacity">
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8"
                                      onClick={() => togglePin(workflow.id)}
                                    >
                                      <Star className={`h-4 w-4 ${pinnedIds.has(workflow.id) ? "fill-yellow-400 text-yellow-400" : ""}`} />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>{pinnedIds.has(workflow.id) ? "Unpin" : "Pin"}</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8"
                                      onClick={() => (window.location.href = `/workflows/${workflow.id}`)}
                                    >
                                      <Eye className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>View details</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8"
                                      onClick={() => resolveDeps.mutate({ id: workflow.id })}
                                    >
                                      <RefreshCw className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Rescan</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8"
                                      disabled={missing === 0}
                                    >
                                      <Download className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Download missing</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </div>
                          </TableCell>
                        </TableRow>

                        {/* Expandable Row */}
                        {isExpanded && (
                          <TableRow key={`${workflow.id}-expand`} className="bg-[#111] border-gray-800/30">
                            <TableCell colSpan={8} className="py-4 px-12">
                              <div className="text-sm text-gray-400">
                                <p className="font-medium text-gray-300 mb-2">Required Models:</p>
                                <p className="text-gray-500 italic">
                                  Loading dependencies... (View details for full list)
                                </p>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </Fragment>
                    );
                  })}
                  </TableBody>
                </Table>
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

export default function WorkflowsPage() {
  return <WorkflowsContent />;
}
