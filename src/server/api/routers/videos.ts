import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import { db } from "@/server/db";
import {
  videos,
  videoWorkflows,
  videoTags,
  videoUrls,
  workflows,
  workflowDependencies,
  models,
  settings,
} from "@/server/db/schema";
import { eq, like, or, and, inArray, sql, type SQL } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import {
  scrapeVideoMetadata,
  extractVideoId,
} from "@/server/services/youtube-client";
import {
  VIDEO_TAG_CATEGORIES,
  TAG_SOURCE,
  URL_SOURCE,
  mapArchitectureToBaseModel,
  mapModelTypeToDisplay,
} from "@/lib/config";

// ---------- Helpers ----------

/**
 * Derive auto-tags from a workflow's dependencies and apply to a video.
 * Uses onConflictDoNothing to avoid duplicates.
 * Optimized with batch operations to reduce DB calls.
 */
function deriveAutoTagsFromWorkflow(videoId: string, workflowId: string) {
  const deps = db
    .select()
    .from(workflowDependencies)
    .where(eq(workflowDependencies.workflowId, workflowId))
    .all();

  if (deps.length === 0) return;

  // Batch fetch all resolved models at once
  const resolvedModelIds = deps
    .map((d) => d.resolvedModelId)
    .filter((id): id is string => id !== null);

  const resolvedModels = resolvedModelIds.length > 0
    ? db
        .select()
        .from(models)
        .where(inArray(models.id, resolvedModelIds))
        .all()
    : [];

  const modelById = new Map(resolvedModels.map((m) => [m.id, m]));

  // Build tag rows to insert
  const tagRows: Array<{
    videoId: string;
    category: string;
    value: string;
    source: string;
    createdAt: string;
  }> = [];

  const createdAt = new Date().toISOString();

  for (const dep of deps) {
    // Tag model type
    const displayType = mapModelTypeToDisplay(dep.modelType);
    if (displayType) {
      tagRows.push({
        videoId,
        category: VIDEO_TAG_CATEGORIES.MODEL_TYPE,
        value: displayType,
        source: TAG_SOURCE.AUTO,
        createdAt,
      });
    }

    // Tag base model from expectedArchitecture
    if (dep.expectedArchitecture) {
      const baseModel = mapArchitectureToBaseModel(dep.expectedArchitecture);
      if (baseModel) {
        tagRows.push({
          videoId,
          category: VIDEO_TAG_CATEGORIES.BASE_MODEL,
          value: baseModel,
          source: TAG_SOURCE.AUTO,
          createdAt,
        });
      }
    }

    // If resolved, use more specific info from the model record
    if (dep.resolvedModelId) {
      const model = modelById.get(dep.resolvedModelId);

      if (model) {
        // Use civitaiBaseModel for more specific base model tag
        if (model.civitaiBaseModel) {
          tagRows.push({
            videoId,
            category: VIDEO_TAG_CATEGORIES.BASE_MODEL,
            value: model.civitaiBaseModel,
            source: TAG_SOURCE.AUTO,
            createdAt,
          });
        }

        // Use detectedArchitecture if no expectedArchitecture
        if (!dep.expectedArchitecture && model.detectedArchitecture) {
          const baseModel = mapArchitectureToBaseModel(model.detectedArchitecture);
          if (baseModel) {
            tagRows.push({
              videoId,
              category: VIDEO_TAG_CATEGORIES.BASE_MODEL,
              value: baseModel,
              source: TAG_SOURCE.AUTO,
              createdAt,
            });
          }
        }
      }
    }
  }

  // Bulk insert all tags in a single operation
  if (tagRows.length > 0) {
    db.insert(videoTags).values(tagRows).onConflictDoNothing().run();
  }
}

/**
 * Recalculate all auto-tags for a video from its linked workflows.
 * Deletes existing auto-tags and re-derives from all linked workflows.
 */
function recalculateAutoTags(videoId: string) {
  // Delete all auto-generated tags
  db.delete(videoTags)
    .where(
      and(
        eq(videoTags.videoId, videoId),
        eq(videoTags.source, TAG_SOURCE.AUTO)
      )
    )
    .run();

  // Re-derive from all remaining linked workflows
  const links = db
    .select()
    .from(videoWorkflows)
    .where(eq(videoWorkflows.videoId, videoId))
    .all();

  for (const link of links) {
    deriveAutoTagsFromWorkflow(videoId, link.workflowId);
  }
}

// ---------- Router ----------

export const videosRouter = router({
  // ─── Queries ───────────────────────────────────────────────

  list: publicProcedure
    .input(
      z
        .object({
          search: z.string().optional(),
          tags: z.array(z.string()).optional(),
          limit: z.number().min(1).max(100).optional(),
          offset: z.number().min(0).optional(),
        })
        .optional()
    )
    .query(({ input }) => {
      const filters = input || {};
      const limit = filters.limit || 50;
      const offset = filters.offset || 0;

      // Build WHERE conditions
      const conditions: SQL<unknown>[] = [];

      // Search filter - use SQL LIKE for better performance
      if (filters.search) {
        const searchPattern = `%${filters.search}%`;
        conditions.push(
          or(
            like(videos.title, searchPattern),
            like(videos.channelName, searchPattern),
            like(videos.url, searchPattern)
          )!
        );
      }

      // Tag filter - use subquery
      if (filters.tags && filters.tags.length > 0) {
        conditions.push(
          inArray(videos.id, sql`(SELECT ${videoTags.videoId} FROM ${videoTags} WHERE ${inArray(videoTags.value, filters.tags)})`)
        );
      }

      // Get total count with filters
      const totalQuery = db
        .select({ count: sql<number>`count(*)` })
        .from(videos)
        .where(conditions.length > 0 ? and(...conditions) : undefined);
      const total = totalQuery.get()?.count || 0;

      // Get paginated videos with filters applied in SQL
      const paged = db
        .select()
        .from(videos)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .limit(limit)
        .offset(offset)
        .all();

      // Fetch tags and workflow counts in bulk to avoid N+1
      const videoIds = paged.map(v => v.id);

      // Get all tags for these videos in one query
      const allTags = videoIds.length > 0
        ? db.select().from(videoTags).where(inArray(videoTags.videoId, videoIds)).all()
        : [];

      // Get workflow counts for these videos in one query
      const workflowCounts = videoIds.length > 0
        ? db
            .select({
              videoId: videoWorkflows.videoId,
              count: sql<number>`count(*)`,
            })
            .from(videoWorkflows)
            .where(inArray(videoWorkflows.videoId, videoIds))
            .groupBy(videoWorkflows.videoId)
            .all()
        : [];

      // Build lookup maps
      const tagsByVideoId = new Map<string, typeof allTags>();
      allTags.forEach(tag => {
        if (!tagsByVideoId.has(tag.videoId)) {
          tagsByVideoId.set(tag.videoId, []);
        }
        tagsByVideoId.get(tag.videoId)!.push(tag);
      });

      const workflowCountByVideoId = new Map<string, number>();
      workflowCounts.forEach(wc => {
        workflowCountByVideoId.set(wc.videoId, wc.count);
      });

      // Enrich videos with tags and counts
      const enriched = paged.map((video) => ({
        ...video,
        tags: tagsByVideoId.get(video.id) || [],
        workflowCount: workflowCountByVideoId.get(video.id) || 0,
      }));

      return { videos: enriched, total, limit, offset };
    }),

  get: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(({ input }) => {
      const video = db
        .select()
        .from(videos)
        .where(eq(videos.id, input.id))
        .get();

      if (!video) return null;

      // Get associated workflows with their details (avoid N+1)
      const links = db
        .select()
        .from(videoWorkflows)
        .where(eq(videoWorkflows.videoId, input.id))
        .all();

      // Fetch all workflows in one query
      const workflowIds = links.map(l => l.workflowId);
      const workflowsData = workflowIds.length > 0
        ? db.select().from(workflows).where(inArray(workflows.id, workflowIds)).all()
        : [];

      // Build lookup map
      const workflowById = new Map(workflowsData.map(w => [w.id, w]));

      // Merge links with workflow data
      const linkedWorkflows = links.map((link) => ({
        ...link,
        workflow: workflowById.get(link.workflowId),
      }));

      // Get tags
      const tags = db
        .select()
        .from(videoTags)
        .where(eq(videoTags.videoId, input.id))
        .all();

      // Get URLs
      const urls = db
        .select()
        .from(videoUrls)
        .where(eq(videoUrls.videoId, input.id))
        .all();

      return { video, workflows: linkedWorkflows, tags, urls };
    }),

  stats: publicProcedure.query(() => {
    // Get total count using SQL aggregation
    const totalResult = db
      .select({ count: sql<number>`count(*)` })
      .from(videos)
      .get();
    const total = totalResult?.count || 0;

    // Get tag counts using SQL GROUP BY
    const tagCounts = db
      .select({
        category: videoTags.category,
        value: videoTags.value,
        count: sql<number>`count(*)`,
      })
      .from(videoTags)
      .groupBy(videoTags.category, videoTags.value)
      .all();

    // Organize results by category
    const byModelType: Record<string, number> = {};
    const byBaseModel: Record<string, number> = {};

    for (const row of tagCounts) {
      if (row.category === VIDEO_TAG_CATEGORIES.MODEL_TYPE) {
        byModelType[row.value] = row.count;
      } else if (row.category === VIDEO_TAG_CATEGORIES.BASE_MODEL) {
        byBaseModel[row.value] = row.count;
      }
    }

    return { total, byModelType, byBaseModel };
  }),

  hasGoogleApiKey: publicProcedure.query(() => {
    const setting = db
      .select()
      .from(settings)
      .where(eq(settings.key, "google_api_key"))
      .get();
    return {
      hasKey: !!setting?.value,
      keyLength: setting?.value?.length || 0,
    };
  }),

  // ─── Mutations ─────────────────────────────────────────────

  create: publicProcedure
    .input(
      z.object({
        url: z.string().url(),
        workflowIds: z.array(z.string()).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const videoId = extractVideoId(input.url);
      if (!videoId) {
        throw new Error(
          "Invalid YouTube URL. Supported formats: youtube.com/watch?v=, youtu.be/, youtube.com/embed/, youtube.com/shorts/"
        );
      }

      // Scrape metadata
      const metadata = await scrapeVideoMetadata(input.url);

      const id = uuidv4();
      const now = new Date().toISOString();

      // Insert video record
      db.insert(videos)
        .values({
          id,
          url: input.url,
          title: metadata.title,
          description: metadata.description,
          channelName: metadata.channelName,
          publishedAt: metadata.publishedAt,
          thumbnailUrl: metadata.thumbnailUrl,
          duration: metadata.duration,
          createdAt: now,
          updatedAt: now,
        })
        .run();

      // Insert scraped URLs from description
      if (metadata.descriptionUrls.length > 0) {
        for (const url of metadata.descriptionUrls) {
          db.insert(videoUrls)
            .values({
              videoId: id,
              url,
              source: URL_SOURCE.SCRAPED,
              createdAt: now,
            })
            .run();
        }
      }

      // Link workflows and derive auto-tags
      if (input.workflowIds && input.workflowIds.length > 0) {
        for (const wfId of input.workflowIds) {
          // Verify workflow exists
          const wf = db
            .select()
            .from(workflows)
            .where(eq(workflows.id, wfId))
            .get();
          if (wf) {
            db.insert(videoWorkflows)
              .values({
                videoId: id,
                workflowId: wfId,
                createdAt: now,
              })
              .run();
            deriveAutoTagsFromWorkflow(id, wfId);
          }
        }
      }

      return db.select().from(videos).where(eq(videos.id, id)).get();
    }),

  update: publicProcedure
    .input(
      z.object({
        id: z.string(),
        title: z.string().optional(),
        cloudRenderUrl: z.string().optional(),
      })
    )
    .mutation(({ input }) => {
      const { id, ...fields } = input;
      const updates: Record<string, unknown> = {
        updatedAt: new Date().toISOString(),
      };
      if (fields.title !== undefined) updates.title = fields.title;
      if (fields.cloudRenderUrl !== undefined)
        updates.cloudRenderUrl = fields.cloudRenderUrl;

      db.update(videos).set(updates).where(eq(videos.id, id)).run();

      return db.select().from(videos).where(eq(videos.id, id)).get();
    }),

  delete: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ input }) => {
      db.delete(videos).where(eq(videos.id, input.id)).run();
      return { success: true };
    }),

  addWorkflow: publicProcedure
    .input(
      z.object({
        videoId: z.string(),
        workflowId: z.string(),
        notes: z.string().optional(),
      })
    )
    .mutation(({ input }) => {
      // Check if already linked
      const existing = db
        .select()
        .from(videoWorkflows)
        .where(
          and(
            eq(videoWorkflows.videoId, input.videoId),
            eq(videoWorkflows.workflowId, input.workflowId)
          )
        )
        .get();

      if (existing) {
        throw new Error("Workflow is already linked to this video");
      }

      db.insert(videoWorkflows)
        .values({
          videoId: input.videoId,
          workflowId: input.workflowId,
          notes: input.notes,
          createdAt: new Date().toISOString(),
        })
        .run();

      // Auto-tag from the new workflow
      deriveAutoTagsFromWorkflow(input.videoId, input.workflowId);

      // Return updated tags
      return db
        .select()
        .from(videoTags)
        .where(eq(videoTags.videoId, input.videoId))
        .all();
    }),

  removeWorkflow: publicProcedure
    .input(
      z.object({
        videoId: z.string(),
        workflowId: z.string(),
      })
    )
    .mutation(({ input }) => {
      db.delete(videoWorkflows)
        .where(
          and(
            eq(videoWorkflows.videoId, input.videoId),
            eq(videoWorkflows.workflowId, input.workflowId)
          )
        )
        .run();

      // Recalculate auto-tags from remaining workflows
      recalculateAutoTags(input.videoId);

      return { success: true };
    }),

  addTag: publicProcedure
    .input(
      z.object({
        videoId: z.string(),
        category: z.enum(["model_type", "base_model", "custom"]),
        value: z.string().trim().min(1).max(100),
      })
    )
    .mutation(({ input }) => {
      db.insert(videoTags)
        .values({
          videoId: input.videoId,
          category: input.category,
          value: input.value,
          source: TAG_SOURCE.MANUAL,
          createdAt: new Date().toISOString(),
        })
        .onConflictDoNothing()
        .run();

      return db
        .select()
        .from(videoTags)
        .where(eq(videoTags.videoId, input.videoId))
        .all();
    }),

  removeTag: publicProcedure
    .input(z.object({ tagId: z.number() }))
    .mutation(({ input }) => {
      db.delete(videoTags).where(eq(videoTags.id, input.tagId)).run();
      return { success: true };
    }),

  addUrl: publicProcedure
    .input(
      z.object({
        videoId: z.string(),
        url: z.string().url(),
        label: z.string().optional(),
      })
    )
    .mutation(({ input }) => {
      db.insert(videoUrls)
        .values({
          videoId: input.videoId,
          url: input.url,
          label: input.label,
          source: URL_SOURCE.MANUAL,
          createdAt: new Date().toISOString(),
        })
        .run();

      return db
        .select()
        .from(videoUrls)
        .where(eq(videoUrls.videoId, input.videoId))
        .all();
    }),

  removeUrl: publicProcedure
    .input(z.object({ urlId: z.number() }))
    .mutation(({ input }) => {
      db.delete(videoUrls).where(eq(videoUrls.id, input.urlId)).run();
      return { success: true };
    }),

  refreshMetadata: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      const video = db
        .select()
        .from(videos)
        .where(eq(videos.id, input.id))
        .get();

      if (!video) throw new Error("Video not found");

      const metadata = await scrapeVideoMetadata(video.url);
      const now = new Date().toISOString();

      db.update(videos)
        .set({
          title: metadata.title || video.title,
          description: metadata.description || video.description,
          channelName: metadata.channelName || video.channelName,
          publishedAt: metadata.publishedAt || video.publishedAt,
          thumbnailUrl: metadata.thumbnailUrl || video.thumbnailUrl,
          duration: metadata.duration || video.duration,
          updatedAt: now,
        })
        .where(eq(videos.id, input.id))
        .run();

      // Update scraped URLs (add new ones found in description)
      if (metadata.descriptionUrls.length > 0) {
        const existingUrls = db
          .select()
          .from(videoUrls)
          .where(eq(videoUrls.videoId, input.id))
          .all()
          .map((u) => u.url);

        for (const url of metadata.descriptionUrls) {
          if (!existingUrls.includes(url)) {
            db.insert(videoUrls)
              .values({
                videoId: input.id,
                url,
                source: URL_SOURCE.SCRAPED,
                createdAt: now,
              })
              .run();
          }
        }
      }

      return db.select().from(videos).where(eq(videos.id, input.id)).get();
    }),

  // Save Google API key to settings
  // Note: API key is stored unencrypted (encrypted: 0) because:
  // 1. This is a local desktop application with file-system-level security
  // 2. The database file is stored locally and protected by OS permissions
  // 3. Encryption would require a master key stored elsewhere, providing minimal additional security
  // 4. Users should protect their system with appropriate authentication/encryption at the OS level
  // For cloud-hosted or multi-user deployments, implement proper encryption with a secure key management system.
  saveGoogleApiKey: publicProcedure
    .input(z.object({ apiKey: z.string() }))
    .mutation(({ input }) => {
      db.insert(settings)
        .values({
          key: "google_api_key",
          value: input.apiKey,
          encrypted: 0, // See comment above for rationale
          updatedAt: new Date().toISOString(),
        })
        .onConflictDoUpdate({
          target: settings.key,
          set: {
            value: input.apiKey,
            updatedAt: new Date().toISOString(),
          },
        })
        .run();

      return { success: true };
    }),
});
