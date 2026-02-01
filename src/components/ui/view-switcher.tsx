"use client";

import { Table2, Grid2x2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ViewMode } from "@/hooks/use-view-mode";

interface ViewSwitcherProps {
  viewMode: ViewMode;
  onViewChange: (mode: ViewMode) => void;
  disabled?: boolean;
  showCards?: boolean;
}

export function ViewSwitcher({
  viewMode,
  onViewChange,
  disabled = false,
  showCards = true,
}: ViewSwitcherProps) {
  return (
    <div className="flex gap-1 border rounded-md p-1 bg-background">
      <Button
        variant={viewMode === "table" ? "default" : "ghost"}
        size="sm"
        onClick={() => onViewChange("table")}
        disabled={disabled}
        className="flex items-center gap-1"
      >
        <Table2 className="h-4 w-4" />
        Table
      </Button>
      {showCards && (
        <Button
          variant={viewMode === "cards" ? "default" : "ghost"}
          size="sm"
          onClick={() => onViewChange("cards")}
          disabled={disabled}
          className="flex items-center gap-1"
        >
          <Grid2x2 className="h-4 w-4" />
          Cards
        </Button>
      )}
    </div>
  );
}
