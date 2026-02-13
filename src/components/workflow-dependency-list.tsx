"use client";

import { FileText, AlertCircle, CheckCircle } from "lucide-react";
import { DependencyFile } from "@/types/workflow-dependencies";

interface WorkflowDependencyListProps {
  files: DependencyFile[];
  highlightedModel?: string;
}

export function WorkflowDependencyList({ files, highlightedModel }: WorkflowDependencyListProps) {
  if (files.length === 0) {
    return (
      <div className="flex items-center justify-center py-8 text-muted-foreground">
        <FileText className="h-5 w-5 mr-2" />
        No dependencies found
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {files.map((file, idx) => {
        const isHighlighted = highlightedModel && file.name === highlightedModel;
        return (
        <div
          key={idx}
          data-model-name={file.name}
          className={`flex items-center justify-between gap-3 p-3 rounded-lg border transition-all duration-300 ${
            isHighlighted
              ? "ring-2 ring-green-400/60 shadow-[0_0_12px_rgba(74,222,128,0.15)] bg-green-950/30 border-green-700"
              : file.exists
                ? "bg-green-50/50 border-green-200 dark:bg-green-950/30 dark:border-green-800"
                : "bg-yellow-50/50 border-yellow-200 dark:bg-yellow-950/30 dark:border-yellow-800"
          }`}
        >
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="flex-shrink-0">
              {file.exists ? (
                <CheckCircle className="h-5 w-5 text-green-600" />
              ) : (
                <AlertCircle className="h-5 w-5 text-yellow-600" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">{file.emoji}</span>
                <p className="font-mono text-sm font-medium truncate">{file.name}</p>
              </div>
              <div className="text-xs text-muted-foreground">
                {file.displayName}
                {!file.exists && <span className="ml-2 font-medium text-yellow-700">Missing</span>}
              </div>
            </div>
          </div>

          <div className="flex-shrink-0 text-right">
            <p className="font-mono text-sm font-semibold">{file.size}</p>
          </div>
        </div>
        );
      })}
    </div>
  );
}
