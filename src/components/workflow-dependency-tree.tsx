"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle, AlertCircle, Loader2, Layers, Table2, Network, Folder, File, Cpu, AlertTriangle } from "lucide-react";
import { WorkflowDependencyList } from "./workflow-dependency-list";

type ViewType = "tree" | "table" | "graph";

interface WorkflowDependencyTreeProps {
  workflowId: string;
  highlightedModel?: string;
}

interface DependencyFile {
  modelType: string;
  displayName: string;
  name: string;
  size: string;
  sizeBytes: number;
  path: string;
  exists: boolean;
  emoji: string;
  vramGB?: number;
}

// Tree node structure
interface DependencyTreeNode {
  type: "folder" | "file";
  name: string;
  emoji: string;
  size?: string;
  vramGB?: number;
  status?: "\u2705" | "\u274c";
  children?: DependencyTreeNode[];
}

function getVramColor(peakGB: number): string {
  if (peakGB <= 14) return "text-green-600 dark:text-green-400";
  if (peakGB <= 22) return "text-yellow-600 dark:text-yellow-400";
  if (peakGB <= 46) return "text-orange-600 dark:text-orange-400";
  return "text-red-600 dark:text-red-400";
}

function getVramBadgeVariant(peakGB: number): "default" | "secondary" | "destructive" | "outline" {
  if (peakGB <= 14) return "secondary";
  if (peakGB <= 22) return "outline";
  return "destructive";
}

function getGpuTierLabel(canRunOn: { vram16gb: boolean; vram24gb: boolean; vram48gb: boolean; vram80gb: boolean }): string {
  if (canRunOn.vram16gb) return "16 GB GPU";
  if (canRunOn.vram24gb) return "24 GB GPU";
  if (canRunOn.vram48gb) return "48 GB GPU";
  if (canRunOn.vram80gb) return "80 GB GPU";
  return "80+ GB GPU";
}

function buildTree(files: DependencyFile[]): DependencyTreeNode {
  const root: DependencyTreeNode = {
    type: "folder",
    name: "Data/Models",
    emoji: "\ud83d\udce6",
    children: [],
  };

  // Group by modelType
  const grouped = files.reduce(
    (acc, file) => {
      if (!acc[file.modelType]) {
        acc[file.modelType] = [];
      }
      acc[file.modelType].push(file);
      return acc;
    },
    {} as Record<string, DependencyFile[]>
  );

  // Build folder structure
  for (const [modelType, typeFiles] of Object.entries(grouped)) {
    const folderVram = typeFiles.reduce((sum, f) => sum + (f.vramGB || 0), 0);
    const folder: DependencyTreeNode = {
      type: "folder",
      name: modelType,
      emoji: typeFiles[0]?.emoji || "\ud83d\udce6",
      vramGB: Math.round(folderVram * 100) / 100,
      children: typeFiles.map((file) => ({
        type: "file" as const,
        name: file.name,
        emoji: "\ud83d\udcc4",
        size: file.size,
        vramGB: file.vramGB,
        status: file.exists ? ("\u2705" as const) : ("\u274c" as const),
      })),
    };
    root.children?.push(folder);
  }

  return root;
}

function TreeNodeRow({ node, depth = 0, highlightedModel }: { node: DependencyTreeNode; depth?: number; highlightedModel?: string }) {
  const isFolder = node.type === "folder";
  const isHighlighted = !isFolder && highlightedModel && node.name === highlightedModel;

  return (
    <div>
      <div
        data-model-name={!isFolder ? node.name : undefined}
        className={`flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted/50 rounded-md transition-all duration-300 ${
          isHighlighted ? "ring-2 ring-green-400/60 bg-green-950/30" : ""
        }`}
        style={{ paddingLeft: `${12 + depth * 20}px` }}
      >
        <span className="text-lg">{node.emoji}</span>
        <span className="text-muted-foreground flex-shrink-0">
          {isFolder ? <Folder className="h-4 w-4" /> : <File className="h-4 w-4" />}
        </span>
        <span className="font-medium flex-1 truncate">{node.name}</span>
        {node.vramGB !== undefined && node.vramGB > 0 && (
          <span className={`text-xs font-mono flex-shrink-0 ${isFolder ? getVramColor(node.vramGB * 1.3) : "text-muted-foreground"}`}>
            ~{node.vramGB.toFixed(1)} GB
          </span>
        )}
        {node.size && <span className="text-xs text-muted-foreground font-mono">{node.size}</span>}
        {node.status && <span className="text-lg">{node.status}</span>}
      </div>
      {node.children && node.children.map((child, idx) => <TreeNodeRow key={idx} node={child} depth={depth + 1} highlightedModel={highlightedModel} />)}
    </div>
  );
}

export function WorkflowDependencyTree({ workflowId, highlightedModel }: WorkflowDependencyTreeProps) {
  const [activeViews, setActiveViews] = useState<ViewType[]>(["tree", "table"]);

  // Fetch tree data
  const { data: treeData, isLoading: isTreeLoading } = trpc.workflows.dependencyTreeData.useQuery(
    { id: workflowId },
    { enabled: !!workflowId }
  );

  const toggleView = (view: ViewType) => {
    setActiveViews((prev) => {
      if (prev.includes(view)) {
        if (prev.length === 1) return prev;
        return prev.filter((v) => v !== view);
      }
      return [...prev, view];
    });
  };

  if (isTreeLoading) {
    return (
      <Card className="flex flex-col h-full">
        <CardHeader className="flex-shrink-0">
          <CardTitle className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading Dependencies...
          </CardTitle>
        </CardHeader>
      </Card>
    );
  }

  if (!treeData) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>No dependency data available</AlertDescription>
      </Alert>
    );
  }

  const { summary, allFiles, vramEstimate } = treeData;
  const statusColor = summary.ready
    ? "bg-green-50 dark:bg-green-950/30"
    : "bg-yellow-50 dark:bg-yellow-950/30";
  const StatusIcon = summary.ready ? CheckCircle : AlertCircle;

  const tree = buildTree(allFiles);

  return (
    <Card className="flex flex-col h-full">
      <CardHeader className={`${statusColor} flex-shrink-0`}>
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3 flex-1">
            <StatusIcon className={`h-5 w-5 mt-1 flex-shrink-0 ${summary.ready ? "text-green-600" : "text-yellow-600"}`} />
            <div className="flex-1">
              <CardTitle>Workflow Dependencies</CardTitle>
              <CardDescription>
                {summary.ready
                  ? "All dependencies installed - workflow ready to run"
                  : `${summary.missingFiles} file${summary.missingFiles !== 1 ? "s" : ""} missing`}
              </CardDescription>
            </div>
          </div>

          {/* VRAM Summary Badge */}
          {vramEstimate && (
            <div className="flex flex-col items-end gap-1 flex-shrink-0 ml-4">
              <Badge variant={getVramBadgeVariant(vramEstimate.peakEstimate)} className="flex items-center gap-1.5 px-2.5 py-1">
                <Cpu className="h-3.5 w-3.5" />
                <span className="font-mono text-sm">~{vramEstimate.peakEstimate} GB VRAM</span>
              </Badge>
              <span className="text-xs text-muted-foreground">
                Min {getGpuTierLabel(vramEstimate.canRunOn)}
              </span>
            </div>
          )}
        </div>

        {/* VRAM Breakdown + Warnings */}
        {vramEstimate && (vramEstimate.breakdown.length > 0 || vramEstimate.warnings.length > 0) && (
          <div className="mt-3 space-y-2">
            {/* Per-type breakdown */}
            {vramEstimate.breakdown.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {vramEstimate.breakdown.map((item) => (
                  <span
                    key={item.type}
                    className="inline-flex items-center gap-1 text-xs text-muted-foreground bg-background/60 rounded px-2 py-0.5"
                  >
                    <span className="capitalize">{item.type}</span>
                    <span className="font-mono">{item.vram} GB</span>
                    {item.count > 1 && <span>({item.count}x)</span>}
                  </span>
                ))}
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground bg-background/60 rounded px-2 py-0.5">
                  <span>overhead</span>
                  <span className="font-mono">{(vramEstimate.peakEstimate - vramEstimate.baseVram).toFixed(1)} GB</span>
                </span>
              </div>
            )}

            {/* Warnings */}
            {vramEstimate.warnings.length > 0 && (
              <div className="space-y-1">
                {vramEstimate.warnings.map((warning, i) => (
                  <div key={i} className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
                    <AlertTriangle className="h-3 w-3 flex-shrink-0" />
                    <span>{warning}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardHeader>

      <CardContent className="pt-4 flex-1 flex flex-col min-h-0">
        {/* View Toggle Buttons */}
        <div className="flex gap-2 mb-4 flex-shrink-0">
          <Button
            variant={activeViews.includes("tree") ? "default" : "outline"}
            size="sm"
            onClick={() => toggleView("tree")}
            className="flex items-center gap-2"
          >
            <Layers className="h-4 w-4" />
            Tree View
          </Button>
          <Button
            variant={activeViews.includes("table") ? "default" : "outline"}
            size="sm"
            onClick={() => toggleView("table")}
            className="flex items-center gap-2"
          >
            <Table2 className="h-4 w-4" />
            Table View
          </Button>
          <Button
            variant={activeViews.includes("graph") ? "default" : "outline"}
            size="sm"
            onClick={() => toggleView("graph")}
            className="flex items-center gap-2"
            disabled
          >
            <Network className="h-4 w-4" />
            Graph View
          </Button>
        </div>

        {/* Split View Container */}
        <div className={`flex-1 flex gap-4 min-h-0 ${activeViews.length === 1 ? "flex-col" : "flex-row"}`}>
          {/* Tree View */}
          {activeViews.includes("tree") && (
            <div className={`flex flex-col min-h-0 ${activeViews.length === 1 ? "flex-1" : "w-1/2"} border rounded-lg overflow-hidden`}>
              <div className="flex-1 overflow-y-auto bg-background">
                <TreeNodeRow node={tree} highlightedModel={highlightedModel} />
              </div>
            </div>
          )}

          {/* Table View */}
          {activeViews.includes("table") && (
            <div className={`flex flex-col min-h-0 ${activeViews.length === 1 ? "flex-1" : "w-1/2"} border rounded-lg overflow-hidden`}>
              <div className="flex-1 overflow-y-auto">
                <WorkflowDependencyList files={allFiles} highlightedModel={highlightedModel} />
              </div>
            </div>
          )}

          {/* Graph View - Placeholder */}
          {activeViews.includes("graph") && (
            <div className={`flex flex-col min-h-0 ${activeViews.length === 1 ? "flex-1" : "w-1/2"} border rounded-lg overflow-hidden`}>
              <div className="flex-1 flex items-center justify-center bg-muted/20">
                <div className="text-center text-muted-foreground">
                  <Network className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>Graph view coming soon</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
