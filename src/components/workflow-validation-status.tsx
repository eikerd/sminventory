"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle, Clock, Eye, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface ValidationStatusProps {
  workflowId: string;
}

export function WorkflowValidationStatus({ workflowId }: ValidationStatusProps) {
  const [isValidating, setIsValidating] = useState(false);

  const validationQuery = trpc.executions.getDependencyValidationStatus.useQuery(
    { workflowId },
    {
      refetchInterval: false, // Only refetch on demand
    }
  );

  const validateMutation = trpc.executions.validateDependencies.useMutation({
    onSuccess: (data) => {
      toast.success(
        `Validation complete: ${data.foundCount}/${data.totalDependencies} models found`
      );
      validationQuery.refetch();
      setIsValidating(false);
    },
    onError: (error) => {
      toast.error(`Validation failed: ${error.message}`);
      setIsValidating(false);
    },
  });

  const handleValidate = () => {
    setIsValidating(true);
    validateMutation.mutate({ workflowId });
  };

  if (validationQuery.isLoading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Path Validation</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const validationData = validationQuery.data || [];
  const staleCount = validationData.filter((d) => d.isStale).length;
  const needsValidationCount = validationData.filter((d) => d.needsValidation).length;
  const withWorkingPaths = validationData.filter((d) => d.verifiedWorkingPath).length;

  // Get most recent validation timestamp
  const mostRecentValidation = validationData
    .filter((d) => d.lastValidatedAt)
    .sort((a, b) => {
      if (!a.lastValidatedAt || !b.lastValidatedAt) return 0;
      return new Date(b.lastValidatedAt).getTime() - new Date(a.lastValidatedAt).getTime();
    })[0];

  const formatTimeAgo = (timestamp: string | null) => {
    if (!timestamp) return "Never";
    const now = new Date().getTime();
    const then = new Date(timestamp).getTime();
    const diffMs = now - then;
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffHours < 1) return "Just now";
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Eye className="h-4 w-4" />
          Path Validation
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Validation Status */}
        <div className="space-y-2">
          {needsValidationCount > 0 ? (
            <Badge variant="outline" className="text-yellow-600 border-yellow-600">
              <AlertCircle className="h-3 w-3 mr-1" />
              {needsValidationCount} need validation
            </Badge>
          ) : (
            <Badge variant="outline" className="text-green-600 border-green-600">
              <CheckCircle className="h-3 w-3 mr-1" />
              All paths validated
            </Badge>
          )}

          {/* Last Validation Time */}
          {mostRecentValidation && (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Last validated: {formatTimeAgo(mostRecentValidation.lastValidatedAt)}
            </p>
          )}

          {/* Verified Working Paths Count */}
          {withWorkingPaths > 0 && (
            <p className="text-xs text-muted-foreground">
              {withWorkingPaths} {withWorkingPaths === 1 ? "path" : "paths"} verified from executions
            </p>
          )}
        </div>

        {/* Peek Button */}
        <Button
          variant="outline"
          size="sm"
          onClick={handleValidate}
          disabled={isValidating || validateMutation.isPending}
          className="w-full"
        >
          {isValidating || validateMutation.isPending ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Validating...
            </>
          ) : (
            <>
              <Eye className="h-4 w-4 mr-2" />
              Peek & Validate Now
            </>
          )}
        </Button>

        {/* Stale Warning */}
        {staleCount > 0 && !isValidating && (
          <p className="text-xs text-yellow-600">
            {staleCount} {staleCount === 1 ? "path" : "paths"} not validated in 24h
          </p>
        )}
      </CardContent>
    </Card>
  );
}
