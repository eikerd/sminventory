"use client";

import { useRef, useEffect } from "react";
import type { ScanEvent } from "@/types/scan-events";

interface ScanConsoleProps {
  events: ScanEvent[];
  active: boolean;
}

type Phase = ScanEvent["phase"];

const PHASE_LABELS: Record<Phase, string> = {
  start: "START",
  parse: "PARSE",
  extract: "EXTRACT",
  check: "CHECK",
  resolve: "RESOLVE",
  vram: "VRAM",
  tags: "TAGS",
  complete: "DONE",
};

const PHASE_COLORS: Record<Phase, string> = {
  start: "text-cyan-400",
  parse: "text-blue-400",
  extract: "text-blue-300",
  check: "text-green-400",
  resolve: "text-purple-400",
  vram: "text-orange-400",
  tags: "text-pink-400",
  complete: "text-emerald-400",
};

function getResultColor(result: ScanEvent["result"]): string {
  switch (result) {
    case "verified":
    case "success":
      return "text-green-400";
    case "missing":
      return "text-yellow-400";
    case "estimated":
      return "text-orange-300";
    case "warning":
      return "text-amber-500";
    case "info":
    default:
      return "text-zinc-300";
  }
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  const ms = String(d.getMilliseconds()).padStart(3, "0");
  return `${hh}:${mm}:${ss}.${ms}`;
}

export function ScanConsole({ events, active }: ScanConsoleProps) {
  const endRef = useRef<HTMLDivElement>(null);

  // Scroll the latest entry into view within the page
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [events.length]);

  return (
    <div data-testid="scan-console" className="rounded-lg border border-zinc-800 overflow-hidden bg-[#0a0a0a]">
      {/* Title bar */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-zinc-900 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <div className={`h-2 w-2 rounded-full ${active ? "bg-green-500 animate-pulse" : "bg-zinc-600"}`} />
          <span className="text-xs font-mono text-zinc-400">Scan Console</span>
          {active && <span className="text-xs text-zinc-500">scanning...</span>}
          {!active && events.length > 0 && (
            <span className="text-xs text-zinc-600">{events.length} entries</span>
          )}
        </div>
      </div>

      {/* Log area - auto-expands to fit content, min 500px tall */}
      <div className="min-h-[500px] p-2 font-mono text-xs leading-relaxed">
        {events.length === 0 && (
          <div className="text-zinc-600 italic">Waiting for scan to start...</div>
        )}
        {events.map((event, i) => {
          const phaseLabel = PHASE_LABELS[event.phase] || event.phase.toUpperCase();
          const phaseColor = PHASE_COLORS[event.phase] || "text-zinc-400";
          const resultColor = getResultColor(event.result);

          return (
            <div key={i} data-testid="scan-console-entry" className="flex gap-1">
              <span className="text-zinc-600 flex-shrink-0">[{formatTimestamp(event.timestamp)}]</span>
              <span className={`flex-shrink-0 ${phaseColor}`}>[{phaseLabel}]</span>
              <span className={resultColor}>
                {event.action}
                {event.sizeFormatted && (
                  <span className="text-zinc-500"> ({event.sizeFormatted})</span>
                )}
                {event.vramGB !== undefined && !event.action.includes("GB") && (
                  <span className="text-zinc-500"> ~{event.vramGB} GB</span>
                )}
              </span>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>
    </div>
  );
}
