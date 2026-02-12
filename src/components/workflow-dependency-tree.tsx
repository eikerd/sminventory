"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { CheckCircle, AlertCircle, Loader2, Layers, Table2, Network, Folder, File } from "lucide-react";
import { WorkflowDependencyList } from "./workflow-dependency-list";

type ViewType = "tree" | "table" | "graph";

interface WorkflowDependencyTreeProps {
  workflowId: string;
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
}

// Tree node structure
interface TreeNode {
  type: "folder" | "file";
  name: string;
  emoji: string;
  size?: string;
  status?: "✅" | "❌";
  children?: TreeNode[];
}

function buildTree(files: DependencyFile[]): TreeNode {
  const root: TreeNode = {
    type: "folder",
    name: "Data/Models",
    emoji: "📦",
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
    const folder: TreeNode = {
      type: "folder",
      name: modelType,
      emoji: typeFiles[0]?.emoji || "📦",
      children: typeFiles.map((file) => ({
        type: "file" as const,
        name: file.name,
        emoji: "📄",
        size: file.size,
        status: file.exists ? ("✅" as const) : ("❌" as const),
      })),
    };
    root.children?.push(folder);
  }

  return root;
}

function TreeNode({ node, depth = 0 }: { node: TreeNode; depth?: number }) {
  const isFolder = node.type === "folder";
  const Icon = isFolder ? Folder : File;

  return (
    <div>
      <div
        className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted/50 rounded-md"
        style={{ paddingLeft: `${12 + depth * 20}px` }}
      >
        <span className="text-lg">{node.emoji}</span>
        <span className="text-muted-foreground flex-shrink-0">
          {isFolder ? <Folder className="h-4 w-4" /> : <File className="h-4 w-4" />}
        </span>
        <span className="font-medium flex-1 truncate">{node.name}</span>
        {node.size && <span className="text-xs text-muted-foreground font-mono">{node.size}</span>}
        {node.status && <span className="text-lg">{node.status}</span>}
      </div>
      {node.children && node.children.map((child, idx) => <TreeNode key={idx} node={child} depth={depth + 1} />)}
    </div>
  );
}

export function WorkflowDependencyTree({ workflowId }: WorkflowDependencyTreeProps) {
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

  const { summary, allFiles } = treeData;
  const statusColor = summary.ready ? "bg-green-50" : "bg-yellow-50";
  const statusIcon = summary.ready ? CheckCircle : AlertCircle;
  const StatusIcon = statusIcon;

  const tree = buildTree(allFiles);

  return (
    <Card className="flex flex-col h-full">
      <CardHeader className={`${statusColor} flex-shrink-0`}>
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3 flex-1">
            <StatusIcon className={`h-5 w-5 mt-1 flex-shrink-0 ${summary.ready ? "text-green-600" : "text-yellow-600"}`} />
            <div>
              <CardTitle>Workflow Dependencies</CardTitle>
              <CardDescription>
                {summary.ready
                  ? "✅ All dependencies installed - workflow ready to run"
                  : `⚠️ ${summary.missingFiles} file${summary.missingFiles !== 1 ? "s" : ""} missing`}
              </CardDescription>
            </div>
          </div>
        </div>
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
                <TreeNode node={tree} />
              </div>
            </div>
          )}

          {/* Table View */}
          {activeViews.includes("table") && (
            <div className={`flex flex-col min-h-0 ${activeViews.length === 1 ? "flex-1" : "w-1/2"} border rounded-lg overflow-hidden`}>
              <div className="flex-1 overflow-y-auto">
                <WorkflowDependencyList files={allFiles} />
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
