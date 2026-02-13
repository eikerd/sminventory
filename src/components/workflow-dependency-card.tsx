"use client";

import { CheckCircle, AlertCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { DependencyFile } from "@/types/workflow-dependencies";

interface WorkflowDependencyCardProps {
  files: DependencyFile[];
}

export function WorkflowDependencyCard({ files }: WorkflowDependencyCardProps) {
  // Group files by model type
  const groupedByType = files.reduce(
    (acc, file) => {
      if (!acc[file.modelType]) {
        acc[file.modelType] = [];
      }
      acc[file.modelType].push(file);
      return acc;
    },
    {} as Record<string, DependencyFile[]>
  );

  if (files.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-muted-foreground">
        <p>No dependencies found</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
      {Object.entries(groupedByType).map(([modelType, typeFiles]) => (
        <Card key={modelType} className="p-4">
          <div className="mb-3 flex items-center gap-2">
            <span className="text-2xl">{typeFiles[0]?.emoji}</span>
            <div>
              <h3 className="font-semibold text-sm">{typeFiles[0]?.displayName}</h3>
              <p className="text-xs text-muted-foreground">
                {typeFiles.length} file{typeFiles.length !== 1 ? "s" : ""}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            {typeFiles.map((file, idx) => (
              <div
                key={idx}
                className={`p-2 rounded border text-sm ${
                  file.exists
                    ? "bg-green-50/50 border-green-200 dark:bg-green-950/30 dark:border-green-800"
                    : "bg-yellow-50/50 border-yellow-200 dark:bg-yellow-950/30 dark:border-yellow-800"
                }`}
              >
                <div className="flex items-start gap-2 mb-1">
                  {file.exists ? (
                    <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-mono text-xs truncate">{file.name}</p>
                    <p className="text-xs text-muted-foreground">{file.size}</p>
                  </div>
                </div>
                {!file.exists && (
                  <div className="ml-6 text-xs font-medium text-yellow-700">Missing</div>
                )}
              </div>
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}
