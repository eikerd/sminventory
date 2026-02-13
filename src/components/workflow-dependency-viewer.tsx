"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table";
import {
  CheckCircle,
  XCircle,
  Cloud,
  AlertCircle,
  Download,
  FolderTree,
  Network,
  Table2,
  AlertTriangle,
} from "lucide-react";
import { DEP_STATUS } from "@/lib/config";
import { formatBytes } from "@/lib/task-utils";

// Types
type WorkflowDependency = {
  workflowId: string;
  nodeId: string;
  nodeType: string | null;
  modelType: string;
  modelName: string;
  resolvedModelId: string | null;
  status: string | null;
  civitaiUrl: string | null;
  huggingfaceUrl: string | null;
  estimatedSize: number | null;
  expectedArchitecture: string | null;
  compatibilityIssue: string | null;
};

type WorkflowInfo = {
  id: string;
  name?: string | null;
  filename?: string | null;
  status?: string | null;
  totalDependencies: number;
  resolvedLocal: number;
  resolvedWarehouse: number;
  missingCount: number;
};

interface WorkflowDependencyViewerProps {
  workflow: WorkflowInfo;
  dependencies: WorkflowDependency[];
  compact?: boolean; // If true, use smaller height and condensed view
}

function getStatusIcon(status: string | null) {
  switch (status) {
    case DEP_STATUS.RESOLVED_LOCAL:
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    case DEP_STATUS.RESOLVED_WAREHOUSE:
      return <Cloud className="h-4 w-4 text-blue-500" />;
    case DEP_STATUS.MISSING:
      return <XCircle className="h-4 w-4 text-red-500" />;
    case DEP_STATUS.INCOMPATIBLE:
      return <AlertCircle className="h-4 w-4 text-orange-500" />;
    default:
      return <AlertCircle className="h-4 w-4 text-gray-500" />;
  }
}

function getStatusLabel(status: string | null) {
  switch (status) {
    case DEP_STATUS.RESOLVED_LOCAL:
      return "Local";
    case DEP_STATUS.RESOLVED_WAREHOUSE:
      return "Warehouse";
    case DEP_STATUS.MISSING:
      return "Missing";
    case DEP_STATUS.INCOMPATIBLE:
      return "Incompatible";
    default:
      return "Unresolved";
  }
}

export function WorkflowDependencyViewer({
  workflow,
  dependencies,
  compact = false,
}: WorkflowDependencyViewerProps) {
  const [activeTab, setActiveTab] = useState("tree");
  const scrollHeight = compact ? "h-[300px]" : "h-[400px]";

  // Group dependencies by model type for tree view
  const depsByType = dependencies.reduce((acc, dep) => {
    if (!acc[dep.modelType]) {
      acc[dep.modelType] = [];
    }
    acc[dep.modelType].push(dep);
    return acc;
  }, {} as Record<string, WorkflowDependency[]>);

  if (dependencies.length === 0) {
    return (
      <div className={`flex items-center justify-center ${scrollHeight} border rounded-lg bg-muted/20`}>
        <div className="text-center text-muted-foreground">
          <AlertTriangle className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>No dependencies found</p>
          <p className="text-xs mt-1">This workflow has no model dependencies</p>
        </div>
      </div>
    );
  }

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="tree" className="flex items-center gap-2">
          <FolderTree className="h-4 w-4" />
          Tree
        </TabsTrigger>
        <TabsTrigger value="table" className="flex items-center gap-2">
          <Table2 className="h-4 w-4" />
          Table
        </TabsTrigger>
        <TabsTrigger value="graph" className="flex items-center gap-2">
          <Network className="h-4 w-4" />
          Graph
        </TabsTrigger>
      </TabsList>

      {/* Tree View */}
      <TabsContent value="tree" className="mt-4">
        <ScrollArea className={scrollHeight}>
          <div className="space-y-4 pr-4">
            {Object.entries(depsByType).map(([type, deps]) => (
              <div key={type} className="space-y-2">
                <div className="flex items-center gap-2">
                  <FolderTree className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium text-sm capitalize">
                    {type.replace(/_/g, " ")}
                  </span>
                  <Badge variant="secondary" className="text-xs">
                    {deps.length}
                  </Badge>
                </div>
                <div className="ml-6 space-y-1.5">
                  {deps.map((dep) => (
                    <div
                      key={`${dep.nodeId}-${dep.modelName}`}
                      className="flex items-center justify-between rounded-lg border px-3 py-2 bg-card hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        {getStatusIcon(dep.status)}
                        <span className="font-mono text-sm truncate">
                          {dep.modelName}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <Badge variant="outline" className="text-xs">
                          {getStatusLabel(dep.status)}
                        </Badge>
                        {dep.estimatedSize && (
                          <span className="text-xs text-muted-foreground">
                            {formatBytes(dep.estimatedSize)}
                          </span>
                        )}
                        {dep.status === DEP_STATUS.MISSING && dep.civitaiUrl && (
                          <Button size="sm" variant="ghost" className="h-6 w-6 p-0">
                            <Download className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </TabsContent>

      {/* Table View */}
      <TabsContent value="table" className="mt-4">
        <div className={scrollHeight}>
          <DataTable
            columns={[
              {
                header: "Name",
                accessor: (dep) => (
                  <div className="flex items-center gap-2">
                    {getStatusIcon(dep.status)}
                    <span className="font-mono text-sm">{dep.modelName}</span>
                  </div>
                ),
                sortKey: "modelName",
                sortable: true,
                className: "w-[40%]",
              },
              {
                header: "Type",
                accessor: (dep) => (
                  <span className="capitalize text-xs">
                    {dep.modelType.replace(/_/g, " ")}
                  </span>
                ),
                sortKey: "modelType",
                sortable: true,
                className: "w-[15%]",
              },
              {
                header: "Status",
                accessor: (dep) => (
                  <Badge variant="outline" className="text-xs">
                    {getStatusLabel(dep.status)}
                  </Badge>
                ),
                sortKey: "status",
                sortable: true,
                className: "w-[15%]",
              },
              {
                header: "Size",
                accessor: (dep) =>
                  dep.estimatedSize ? (
                    <span className="text-sm text-muted-foreground">
                      {formatBytes(dep.estimatedSize)}
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  ),
                sortKey: "estimatedSize",
                sortable: true,
                className: "w-[15%]",
              },
              {
                header: "Action",
                accessor: (dep) =>
                  dep.status === DEP_STATUS.MISSING && dep.civitaiUrl ? (
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0">
                      <Download className="h-3 w-3" />
                    </Button>
                  ) : null,
                className: "w-[15%]",
              },
            ]}
            data={dependencies}
            defaultSortKey="modelName"
            defaultSortDirection="asc"
            emptyMessage="No dependencies found."
          />
        </div>
      </TabsContent>

      {/* Graph View */}
      <TabsContent value="graph" className="mt-4">
        <div className={`${scrollHeight} flex items-center justify-center border rounded-lg bg-muted/20`}>
          <div className="text-center text-muted-foreground">
            <Network className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p>Graph view coming soon</p>
            <p className="text-sm">Interactive dependency graph</p>
          </div>
        </div>
      </TabsContent>
    </Tabs>
  );
}
