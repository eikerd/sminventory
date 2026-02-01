"use client";

import { Button } from "@/components/ui/button";
import { RefreshCw, ScanSearch } from "lucide-react";

interface HeaderProps {
  title: string;
  description?: string;
  onScan?: () => void;
  scanning?: boolean;
}

export function Header({ title, description, onScan, scanning }: HeaderProps) {
  return (
    <div className="flex items-center justify-between border-b bg-card px-6 py-4">
      <div>
        <h1 className="text-2xl font-bold">{title}</h1>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      
      {onScan && (
        <Button onClick={onScan} disabled={scanning}>
          {scanning ? (
            <>
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              Scanning...
            </>
          ) : (
            <>
              <ScanSearch className="mr-2 h-4 w-4" />
              Scan Selected
            </>
          )}
        </Button>
      )}
    </div>
  );
}
