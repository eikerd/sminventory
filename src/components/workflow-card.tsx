"use client";

import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { 
  CheckCircle, 
  Cloud, 
  AlertCircle, 
  XCircle, 
  HardDrive,
  Download,
  Eye,
  RefreshCw
} from "lucide-react";
import type { Workflow } from "@/server/db/schema";
import { WORKFLOW_STATUS } from "@/lib/config";

interface WorkflowCardProps {
  workflow: Workflow;
  onView?: () => void;
  onRescan?: () => void;
  onDownload?: () => void;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

function getStatusInfo(status: string | null) {
  switch (status) {
    case WORKFLOW_STATUS.SCANNED_READY_LOCAL:
      return {
        icon: CheckCircle,
        color: "text-green-500",
        bgColor: "bg-green-500/10",
        label: "Ready (Local)",
        badgeVariant: "default" as const,
      };
    case WORKFLOW_STATUS.SCANNED_READY_CLOUD:
      return {
        icon: Cloud,
        color: "text-blue-500",
        bgColor: "bg-blue-500/10",
        label: "Ready (Warehouse)",
        badgeVariant: "secondary" as const,
      };
    case WORKFLOW_STATUS.SCANNED_MISSING:
      return {
        icon: AlertCircle,
        color: "text-yellow-500",
        bgColor: "bg-yellow-500/10",
        label: "Missing Items",
        badgeVariant: "outline" as const,
      };
    case WORKFLOW_STATUS.SCANNED_ERROR:
      return {
        icon: XCircle,
        color: "text-red-500",
        bgColor: "bg-red-500/10",
        label: "Error",
        badgeVariant: "destructive" as const,
      };
    default:
      return {
        icon: RefreshCw,
        color: "text-gray-500",
        bgColor: "bg-gray-500/10",
        label: "Not Scanned",
        badgeVariant: "outline" as const,
      };
  }
}

export function WorkflowCard({ workflow, onView, onRescan, onDownload }: WorkflowCardProps) {
  const statusInfo = getStatusInfo(workflow.status);
  const StatusIcon = statusInfo.icon;
  
  const total = workflow.totalDependencies || 0;
  const resolved = (workflow.resolvedLocal || 0) + (workflow.resolvedWarehouse || 0);
  const progress = total > 0 ? (resolved / total) * 100 : 0;

  return (
    <Card className="flex flex-col hover:shadow-lg transition-shadow">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <CardTitle className="text-lg font-semibold line-clamp-2">
            {workflow.name || workflow.filename}
          </CardTitle>
          <Badge variant={statusInfo.badgeVariant} className="ml-2 shrink-0">
            <StatusIcon className={`w-3 h-3 mr-1 ${statusInfo.color}`} />
            {statusInfo.label}
          </Badge>
        </div>
      </CardHeader>
      
      <CardContent className="flex-1 space-y-4">
        {/* Progress bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>Dependencies</span>
            <span>{resolved}/{total}</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <HardDrive className="w-4 h-4" />
            <span>Size: {formatBytes(workflow.totalSizeBytes || 0)}</span>
          </div>
          {workflow.estimatedVramGb && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <span>VRAM: ~{workflow.estimatedVramGb.toFixed(1)} GB</span>
            </div>
          )}
        </div>

        {/* Missing count */}
        {workflow.missingCount && workflow.missingCount > 0 && (
          <div className="flex items-center gap-2 text-yellow-500 text-sm">
            <AlertCircle className="w-4 h-4" />
            <span>{workflow.missingCount} missing model(s)</span>
          </div>
        )}
      </CardContent>

      <CardFooter className="pt-2 gap-2">
        <Button variant="outline" size="sm" className="flex-1" onClick={onView}>
          <Eye className="w-4 h-4 mr-1" />
          View
        </Button>
        {workflow.status === WORKFLOW_STATUS.NEW && (
          <Button variant="outline" size="sm" onClick={onRescan}>
            <RefreshCw className="w-4 h-4 mr-1" />
            Scan
          </Button>
        )}
        {workflow.missingCount && workflow.missingCount > 0 && (
          <Button variant="default" size="sm" onClick={onDownload}>
            <Download className="w-4 h-4 mr-1" />
            Download
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
