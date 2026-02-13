export interface ScanEvent {
  timestamp: string;
  phase: "start" | "parse" | "extract" | "check" | "resolve" | "vram" | "tags" | "complete";
  modelType?: string;
  modelName?: string;
  action: string;
  result: "success" | "missing" | "estimated" | "verified" | "info" | "warning";
  details?: string;
  sizeBytes?: number;
  sizeFormatted?: string;
  exists?: boolean;
  vramGB?: number;
}
