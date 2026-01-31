"use client";

import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useCallback, useTransition } from "react";

export type ViewMode = "table" | "cards";

interface UseViewModeOptions {
  defaultView?: ViewMode;
}

export function useViewMode(options: UseViewModeOptions = {}) {
  const { defaultView = "table" } = options;
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  // Get current view mode from URL or use default
  const currentView = searchParams.get("view") as ViewMode | null;
  const viewMode = (currentView === "table" || currentView === "cards" ? currentView : defaultView) as ViewMode;

  // Set view mode and update URL
  const setViewMode = useCallback(
    (mode: ViewMode) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("view", mode);

      startTransition(() => {
        router.push(`${pathname}?${params.toString()}`);
      });
    },
    [searchParams, router, pathname]
  );

  return { viewMode, setViewMode, isPending };
}
