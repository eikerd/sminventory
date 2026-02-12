import { sqliteTable, text, integer, real, index, uniqueIndex } from "drizzle-orm/sqlite-core";

// ═══════════════════════════════════════════════════════════════════
// MODELS (with forensics)
// ═══════════════════════════════════════════════════════════════════
export const models = sqliteTable("models", {
  id: text("id").primaryKey(), // SHA256 hash (canonical identity)
  filename: text("filename").notNull(),
  filepath: text("filepath").notNull(),
  location: text("location").notNull(), // 'local' | 'warehouse'

  // Forensics / Identity
  detectedType: text("detected_type"), // checkpoint, lora, vae, controlnet, clip, etc.
  detectedArchitecture: text("detected_architecture"), // SD15, SDXL, Flux, SD3, Pony, unknown
  detectedPrecision: text("detected_precision"), // fp16, fp32, fp8, bf16, gguf
  fileSize: integer("file_size").notNull(),

  // Integrity
  hashStatus: text("hash_status").default("pending"), // valid, corrupt, incomplete, pending
  expectedHash: text("expected_hash"), // From .cm-info.json or CivitAI
  partialHash: text("partial_hash"), // Quick validation (first+last 10MB)

  // CivitAI identity (from hash lookup)
  civitaiModelId: integer("civitai_model_id"),
  civitaiVersionId: integer("civitai_version_id"),
  civitaiName: text("civitai_name"),
  civitaiBaseModel: text("civitai_base_model"),
  civitaiDownloadUrl: text("civitai_download_url"),

  // Embedded metadata (from safetensor header)
  embeddedMetadata: text("embedded_metadata"), // JSON blob
  triggerWords: text("trigger_words"),

  // Timestamps
  createdAt: text("created_at").default("CURRENT_TIMESTAMP"),
  lastVerifiedAt: text("last_verified_at"),
  updatedAt: text("updated_at").default("CURRENT_TIMESTAMP"),
}, (table) => [
  index("idx_models_location").on(table.location),
  index("idx_models_type").on(table.detectedType),
  index("idx_models_architecture").on(table.detectedArchitecture),
  index("idx_models_civitai").on(table.civitaiModelId),
]);

// ═══════════════════════════════════════════════════════════════════
// WORKFLOWS
// ═══════════════════════════════════════════════════════════════════
export const workflows = sqliteTable("workflows", {
  id: text("id").primaryKey(),
  filename: text("filename").notNull(),
  filepath: text("filepath").notNull(),
  name: text("name"),

  // Status: new, scanned-missing-items, scanned-error, scanned-ready-local, scanned-ready-cloud
  status: text("status").default("new"),

  // Dependency summary
  totalDependencies: integer("total_dependencies").default(0),
  resolvedLocal: integer("resolved_local").default(0),
  resolvedWarehouse: integer("resolved_warehouse").default(0),
  missingCount: integer("missing_count").default(0),

  // Size estimation
  totalSizeBytes: integer("total_size_bytes").default(0),
  estimatedVramGb: real("estimated_vram_gb"),

  // Raw content
  rawJson: text("raw_json"),

  // Timestamps
  createdAt: text("created_at").default("CURRENT_TIMESTAMP"),
  scannedAt: text("scanned_at"),
  updatedAt: text("updated_at").default("CURRENT_TIMESTAMP"),
}, (table) => [
  index("idx_workflows_status").on(table.status),
]);

// ═══════════════════════════════════════════════════════════════════
// WORKFLOW DEPENDENCIES
// ═══════════════════════════════════════════════════════════════════
export const workflowDependencies = sqliteTable("workflow_dependencies", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  workflowId: text("workflow_id").notNull().references(() => workflows.id, { onDelete: "cascade" }),

  // Node info from workflow JSON
  nodeId: integer("node_id"),
  nodeType: text("node_type").notNull(), // CheckpointLoaderSimple, LoraLoader, etc.

  // Model reference
  modelType: text("model_type").notNull(), // checkpoint, lora, vae, controlnet, clip, etc.
  modelName: text("model_name").notNull(), // Name as referenced in workflow

  // Resolution: resolved-local, resolved-warehouse, missing, ambiguous, incompatible
  resolvedModelId: text("resolved_model_id").references(() => models.id),
  status: text("status").default("unresolved"),

  // For missing models
  civitaiUrl: text("civitai_url"),
  huggingfaceUrl: text("huggingface_url"),
  estimatedSize: integer("estimated_size"),

  // Compatibility
  expectedArchitecture: text("expected_architecture"),
  compatibilityIssue: text("compatibility_issue"),
}, (table) => [
  index("idx_deps_workflow").on(table.workflowId),
  index("idx_deps_status").on(table.status),
]);

// ═══════════════════════════════════════════════════════════════════
// EXECUTION PROFILES
// ═══════════════════════════════════════════════════════════════════
export const executionProfiles = sqliteTable("execution_profiles", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  maxVramGb: real("max_vram_gb").notNull(),
  preferredPrecision: text("preferred_precision"), // fp8, fp16, fp32
  preferredLocation: text("preferred_location"), // local, warehouse
  isDefault: integer("is_default").default(0),
  createdAt: text("created_at").default("CURRENT_TIMESTAMP"),
});

// ═══════════════════════════════════════════════════════════════════
// WORKFLOW PROFILE STATUS
// ═══════════════════════════════════════════════════════════════════
export const workflowProfileStatus = sqliteTable("workflow_profile_status", {
  workflowId: text("workflow_id").notNull().references(() => workflows.id, { onDelete: "cascade" }),
  profileId: text("profile_id").notNull().references(() => executionProfiles.id, { onDelete: "cascade" }),
  status: text("status").notNull(), // ready, incompatible, oom_risk, missing_deps
  estimatedVramGb: real("estimated_vram_gb"),
  issues: text("issues"), // JSON array of issues
});

// ═══════════════════════════════════════════════════════════════════
// TASKS (master task registry)
// ═══════════════════════════════════════════════════════════════════
export const tasks = sqliteTable("tasks", {
  id: text("id").primaryKey(),
  taskType: text("task_type").notNull(), // 'download', 'model_scan', 'workflow_scan', etc.
  relatedId: text("related_id"), // Foreign key to related entity
  name: text("name").notNull(),
  description: text("description"),
  status: text("status").notNull().default("pending"), // pending, running, paused, completed, failed, cancelled
  priority: integer("priority").default(0),
  progress: integer("progress").default(0),
  currentBytes: integer("current_bytes").default(0),
  totalBytes: integer("total_bytes").default(0),
  currentItems: integer("current_items").default(0),
  totalItems: integer("total_items").default(0),
  speed: integer("speed").default(0),
  eta: integer("eta"),
  errorMessage: text("error_message"),
  retryCount: integer("retry_count").default(0),
  maxRetries: integer("max_retries").default(3),
  createdAt: text("created_at").default("CURRENT_TIMESTAMP"),
  startedAt: text("started_at"),
  pausedAt: text("paused_at"),
  completedAt: text("completed_at"),
  updatedAt: text("updated_at").default("CURRENT_TIMESTAMP"),
  cancellable: integer("cancellable").default(1),
  pausable: integer("pausable").default(1),
}, (table) => [
  index("idx_tasks_status").on(table.status),
  index("idx_tasks_type").on(table.taskType),
]);

// ═══════════════════════════════════════════════════════════════════
// TASK LOGS (detailed progress events)
// ═══════════════════════════════════════════════════════════════════
export const taskLogs = sqliteTable("task_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  taskId: text("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
  timestamp: text("timestamp").default("CURRENT_TIMESTAMP"),
  level: text("level").notNull(), // info, warning, error
  message: text("message").notNull(),
  metadata: text("metadata"),
}, (table) => [
  index("idx_task_logs_task").on(table.taskId),
]);

// ═══════════════════════════════════════════════════════════════════
// DOWNLOAD QUEUE
// ═══════════════════════════════════════════════════════════════════
export const downloadQueue = sqliteTable("download_queue", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  taskId: text("task_id").references(() => tasks.id),
  workflowId: text("workflow_id").references(() => workflows.id),
  dependencyId: integer("dependency_id").references(() => workflowDependencies.id),

  modelName: text("model_name").notNull(),
  modelType: text("model_type").notNull(),
  source: text("source").notNull(), // civitai, huggingface, direct
  url: text("url").notNull(),
  destinationPath: text("destination_path").notNull(),

  expectedSize: integer("expected_size"),
  expectedHash: text("expected_hash"),

  // Status: queued, downloading, validating, complete, failed, cancelled
  status: text("status").default("queued"),
  progress: integer("progress").default(0), // 0-100
  downloadedBytes: integer("downloaded_bytes").default(0),
  errorMessage: text("error_message"),

  resumeToken: text("resume_token"),
  tempFilePath: text("temp_file_path"),
  validationStatus: text("validation_status"),

  createdAt: text("created_at").default("CURRENT_TIMESTAMP"),
  startedAt: text("started_at"),
  completedAt: text("completed_at"),
}, (table) => [
  index("idx_downloads_status").on(table.status),
]);

// ═══════════════════════════════════════════════════════════════════
// SETTINGS (encrypted API keys)
// ═══════════════════════════════════════════════════════════════════
export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  encrypted: integer("encrypted").default(0),
  updatedAt: text("updated_at").default("CURRENT_TIMESTAMP"),
});

// ═══════════════════════════════════════════════════════════════════
// SCAN LOG (for change detection)
// ═══════════════════════════════════════════════════════════════════
export const scanLog = sqliteTable("scan_log", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  path: text("path").notNull(),
  fileCount: integer("file_count"),
  totalSize: integer("total_size"),
  scannedAt: text("scanned_at").default("CURRENT_TIMESTAMP"),
});

// ═══════════════════════════════════════════════════════════════════
// VIDEOS (source of record for workflow tutorials)
// ═══════════════════════════════════════════════════════════════════
export const videos = sqliteTable("videos", {
  id: text("id").primaryKey(),
  url: text("url").notNull(),
  title: text("title"),
  description: text("description"),
  channelName: text("channel_name"),
  publishedAt: text("published_at"),
  thumbnailUrl: text("thumbnail_url"),
  duration: text("duration"),
  cloudRenderUrl: text("cloud_render_url"),
  createdAt: text("created_at").default("CURRENT_TIMESTAMP"),
  updatedAt: text("updated_at").default("CURRENT_TIMESTAMP"),
}, (table) => [
  index("idx_videos_channel").on(table.channelName),
  uniqueIndex("idx_videos_url_unique").on(table.url),
]);

// ═══════════════════════════════════════════════════════════════════
// VIDEO WORKFLOWS (junction: video ↔ workflow)
// ═══════════════════════════════════════════════════════════════════
export const videoWorkflows = sqliteTable("video_workflows", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  videoId: text("video_id").notNull().references(() => videos.id, { onDelete: "cascade" }),
  workflowId: text("workflow_id").notNull().references(() => workflows.id, { onDelete: "cascade" }),
  notes: text("notes"),
  createdAt: text("created_at").default("CURRENT_TIMESTAMP"),
}, (table) => [
  index("idx_video_workflows_video").on(table.videoId),
  index("idx_video_workflows_workflow").on(table.workflowId),
  uniqueIndex("idx_video_workflows_unique").on(table.videoId, table.workflowId),
]);

// ═══════════════════════════════════════════════════════════════════
// VIDEO TAGS (CivitAI taxonomy: model_type, base_model, custom)
// ═══════════════════════════════════════════════════════════════════
export const videoTags = sqliteTable("video_tags", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  videoId: text("video_id").notNull().references(() => videos.id, { onDelete: "cascade" }),
  category: text("category").notNull(), // "model_type" | "base_model" | "custom"
  value: text("value").notNull(),
  source: text("source"), // "auto" | "manual"
  createdAt: text("created_at").default("CURRENT_TIMESTAMP"),
}, (table) => [
  index("idx_video_tags_video").on(table.videoId),
  index("idx_video_tags_category").on(table.category),
  uniqueIndex("idx_video_tags_unique").on(table.videoId, table.category, table.value),
]);

// ═══════════════════════════════════════════════════════════════════
// VIDEO URLS (scraped from description + manually added)
// ═══════════════════════════════════════════════════════════════════
export const videoUrls = sqliteTable("video_urls", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  videoId: text("video_id").notNull().references(() => videos.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  label: text("label"),
  source: text("source"), // "scraped" | "manual"
  createdAt: text("created_at").default("CURRENT_TIMESTAMP"),
}, (table) => [
  index("idx_video_urls_video").on(table.videoId),
  uniqueIndex("idx_video_urls_unique").on(table.videoId, table.url),
]);

// Type exports
export type Video = typeof videos.$inferSelect;
export type NewVideo = typeof videos.$inferInsert;
export type VideoWorkflow = typeof videoWorkflows.$inferSelect;
export type VideoTag = typeof videoTags.$inferSelect;
export type VideoUrl = typeof videoUrls.$inferSelect;

export type Model = typeof models.$inferSelect;
export type NewModel = typeof models.$inferInsert;
export type Workflow = typeof workflows.$inferSelect;
export type NewWorkflow = typeof workflows.$inferInsert;
export type WorkflowDependency = typeof workflowDependencies.$inferSelect;
export type NewWorkflowDependency = typeof workflowDependencies.$inferInsert;
export type ExecutionProfile = typeof executionProfiles.$inferSelect;
export type Task = typeof tasks.$inferSelect;
export type NewTask = typeof tasks.$inferInsert;
export type TaskLog = typeof taskLogs.$inferSelect;
export type NewTaskLog = typeof taskLogs.$inferInsert;
export type DownloadQueueItem = typeof downloadQueue.$inferSelect;
export type Setting = typeof settings.$inferSelect;
