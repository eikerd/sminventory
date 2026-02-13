"use client";

import { useMemo, useCallback } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  type Node,
  type Edge,
  type NodeTypes,
  Handle,
  Position,
  useReactFlow,
  ReactFlowProvider,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { DEP_STATUS } from "@/lib/config";
import { formatBytes } from "@/lib/task-utils";
import type { DependencyFile } from "@/types/workflow-dependencies";

// Extend shared type with optional vramGB used by tree component
type DependencyFileWithVram = DependencyFile & { vramGB?: number };

type WorkflowDependency = {
  workflowId: string;
  nodeId: number | null;
  nodeType: string;
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

// Normalized item for the generic graph builder
interface GraphItem {
  type: string;
  name: string;
  statusColor: string;
  size: string;
}

// Color mapping for status
function getStatusColor(status: string | null | boolean): string {
  if (typeof status === "boolean") {
    return status ? "#22c55e" : "#ef4444";
  }
  switch (status) {
    case DEP_STATUS.RESOLVED_LOCAL:
      return "#22c55e";
    case DEP_STATUS.RESOLVED_WAREHOUSE:
      return "#3b82f6";
    case DEP_STATUS.MISSING:
      return "#ef4444";
    case DEP_STATUS.INCOMPATIBLE:
      return "#f97316";
    default:
      return "#6b7280";
  }
}

// Color mapping for model type groups
const TYPE_COLORS: Record<string, string> = {
  checkpoint: "#8b5cf6",
  lora: "#06b6d4",
  vae: "#f59e0b",
  controlnet: "#ec4899",
  clip: "#14b8a6",
  upscaler: "#84cc16",
  embeddings: "#f43f5e",
  unet: "#a855f7",
  default: "#6b7280",
};

function getTypeColor(type: string): string {
  return TYPE_COLORS[type.toLowerCase()] || TYPE_COLORS.default;
}

// Custom node: center workflow node
function WorkflowNode({ data }: { data: { label: string } }) {
  return (
    <div
      style={{
        background: "linear-gradient(135deg, #1e1b4b, #312e81)",
        border: "2px solid #6366f1",
        borderRadius: "12px",
        padding: "12px 20px",
        color: "white",
        fontWeight: 600,
        fontSize: "13px",
        textAlign: "center",
        minWidth: "140px",
        boxShadow: "0 4px 20px rgba(99, 102, 241, 0.3)",
      }}
    >
      {data.label}
      <Handle type="source" position={Position.Bottom} style={{ background: "#6366f1" }} />
    </div>
  );
}

// Custom node: model type group
function GroupNode({ data }: { data: { label: string; color: string; count: number } }) {
  return (
    <div
      style={{
        background: `${data.color}15`,
        border: `2px solid ${data.color}`,
        borderRadius: "10px",
        padding: "8px 16px",
        color: data.color,
        fontWeight: 600,
        fontSize: "12px",
        textAlign: "center",
        minWidth: "100px",
      }}
    >
      <Handle type="target" position={Position.Top} style={{ background: data.color }} />
      <div>{data.label}</div>
      <div style={{ fontSize: "10px", opacity: 0.7 }}>{data.count} model{data.count !== 1 ? "s" : ""}</div>
      <Handle type="source" position={Position.Bottom} style={{ background: data.color }} />
    </div>
  );
}

// Custom node: individual model
function ModelNode({ data }: { data: { label: string; status: string; size: string; statusColor: string } }) {
  return (
    <div
      style={{
        background: `${data.statusColor}10`,
        border: `1.5px solid ${data.statusColor}`,
        borderRadius: "8px",
        padding: "6px 12px",
        fontSize: "11px",
        minWidth: "120px",
        maxWidth: "200px",
      }}
    >
      <Handle type="target" position={Position.Top} style={{ background: data.statusColor, width: 6, height: 6 }} />
      <div style={{ fontWeight: 500, color: data.statusColor, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {data.label}
      </div>
      {data.size && (
        <div style={{ fontSize: "9px", color: "#9ca3af", marginTop: "2px" }}>{data.size}</div>
      )}
    </div>
  );
}

const nodeTypes: NodeTypes = {
  workflow: WorkflowNode,
  group: GroupNode,
  model: ModelNode,
};

// Generic graph builder for both data shapes
function buildGraph(
  items: GraphItem[],
  workflowName: string,
): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  // Center workflow node
  nodes.push({
    id: "workflow",
    type: "workflow",
    position: { x: 0, y: 0 },
    data: { label: workflowName },
  });

  // Group by type
  const grouped: Record<string, GraphItem[]> = {};
  for (const item of items) {
    if (!grouped[item.type]) grouped[item.type] = [];
    grouped[item.type].push(item);
  }

  const types = Object.keys(grouped);
  const groupWidth = 220;
  const totalWidth = types.length * groupWidth;
  const startX = -totalWidth / 2 + groupWidth / 2;

  types.forEach((type, typeIdx) => {
    const groupId = `group-${type}`;
    const gx = startX + typeIdx * groupWidth;
    const color = getTypeColor(type);

    nodes.push({
      id: groupId,
      type: "group",
      position: { x: gx, y: 120 },
      data: { label: type.replace(/_/g, " "), color, count: grouped[type].length },
    });

    edges.push({
      id: `e-workflow-${groupId}`,
      source: "workflow",
      target: groupId,
      style: { stroke: color, strokeWidth: 2 },
    });

    // Individual models
    const typeItems = grouped[type];
    const modelWidth = 180;
    const totalModelWidth = typeItems.length * modelWidth;
    const modelStartX = gx - totalModelWidth / 2 + modelWidth / 2;

    typeItems.forEach((item, itemIdx) => {
      const modelId = `model-${type}-${itemIdx}`;
      const mx = modelStartX + itemIdx * modelWidth;

      nodes.push({
        id: modelId,
        type: "model",
        position: { x: mx, y: 240 },
        data: {
          label: item.name,
          status: "resolved",
          size: item.size,
          statusColor: item.statusColor,
        },
      });

      edges.push({
        id: `e-${groupId}-${modelId}`,
        source: groupId,
        target: modelId,
        style: { stroke: item.statusColor, strokeWidth: 1.5 },
      });
    });
  });

  return { nodes, edges };
}

// Inner component that can use useReactFlow
function GraphInner({ nodes, edges }: { nodes: Node[]; edges: Edge[] }) {
  const { fitView } = useReactFlow();

  const onInit = useCallback(() => {
    // Delay required: nodes may not be fully rendered when onInit fires,
    // causing fitView to compute incorrect bounds
    setTimeout(() => fitView({ padding: 0.2 }), 50);
  }, [fitView]);

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      onInit={onInit}
      fitView
      minZoom={0.3}
      maxZoom={2}
      defaultEdgeOptions={{ type: "smoothstep" }}
      proOptions={{ hideAttribution: true }}
    >
      <Background gap={20} size={1} />
      <Controls showInteractive={false} />
    </ReactFlow>
  );
}

// Exported component for workflow-dependency-tree.tsx (DependencyFile data)
export function WorkflowDependencyGraphFiles({
  files,
  workflowName = "Workflow",
}: {
  files: DependencyFileWithVram[];
  workflowName?: string;
}) {
  const { nodes, edges } = useMemo(() => {
    const items: GraphItem[] = files.map((f) => ({
      type: f.modelType,
      name: f.name,
      statusColor: getStatusColor(f.exists),
      size: f.size,
    }));
    return buildGraph(items, workflowName);
  }, [files, workflowName]);

  return (
    <ReactFlowProvider>
      <GraphInner nodes={nodes} edges={edges} />
    </ReactFlowProvider>
  );
}

// Exported component for workflow-dependency-viewer.tsx (WorkflowDependency data)
export function WorkflowDependencyGraphDeps({
  dependencies,
  workflowName = "Workflow",
}: {
  dependencies: WorkflowDependency[];
  workflowName?: string;
}) {
  const { nodes, edges } = useMemo(() => {
    const items: GraphItem[] = dependencies.map((d) => ({
      type: d.modelType,
      name: d.modelName,
      statusColor: getStatusColor(d.status),
      size: d.estimatedSize ? formatBytes(d.estimatedSize) : "",
    }));
    return buildGraph(items, workflowName);
  }, [dependencies, workflowName]);

  return (
    <ReactFlowProvider>
      <GraphInner nodes={nodes} edges={edges} />
    </ReactFlowProvider>
  );
}
