"use client";

import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface DownloadButtonProps {
  dependencyId: number;
  workflowId?: string;
  modelName: string;
  disabled?: boolean;
}

export function DownloadButton({
  dependencyId,
  workflowId,
  modelName,
  disabled,
}: DownloadButtonProps) {
  const queueDownload = trpc.downloads.queueFromDependency.useMutation({
    onSuccess: (data) => {
      toast.success(`Queued download: ${modelName}`, {
        description: "Check the Downloads page to monitor progress",
        action: {
          label: "View",
          onClick: () => {
            window.location.href = "/downloads";
          },
        },
      });
    },
    onError: (error) => {
      toast.error("Failed to queue download", {
        description: error.message,
      });
    },
  });

  return (
    <Button
      size="sm"
      variant="outline"
      disabled={disabled || queueDownload.isPending}
      onClick={() =>
        queueDownload.mutate({
          dependencyId,
          workflowId,
        })
      }
    >
      {queueDownload.isPending ? (
        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
      ) : (
        <Download className="h-4 w-4 mr-2" />
      )}
      Download
    </Button>
  );
}
