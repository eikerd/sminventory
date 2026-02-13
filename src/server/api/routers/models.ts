import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import { db } from "@/server/db";
import { models } from "@/server/db/schema";
import { eq, like, and, or, count } from "drizzle-orm";
import { scanAllModels, scanModelsDirectory, getModelStats } from "@/server/services/model-indexer";
import { analyzeModel } from "@/server/services/forensics";
import { CONFIG } from "@/lib/config";

type ModelRecord = typeof models.$inferSelect;

type TreeNode = {
  name: string;
  path: string;
  type: "folder" | "file";
  location: "local" | "warehouse";
  children?: TreeNode[];
  model?: ModelRecord;
};

export const modelsRouter = router({
  // Get all models with optional filters
  list: publicProcedure
    .input(
      z
        .object({
          location: z.enum(["local", "warehouse", "all"]).optional(),
          type: z.string().optional(),
          architecture: z.string().optional(),
          status: z.string().optional(),
          search: z.string().optional(),
          limit: z.number().min(1).max(1000).optional(),
          offset: z.number().min(0).optional(),
        })
        .optional()
    )
    .query(({ input }) => {
      const filters = input || {};
      let query = db.select().from(models);

      // Build conditions array
      const conditions = [];

      if (filters.location && filters.location !== "all") {
        conditions.push(eq(models.location, filters.location));
      }
      if (filters.type) {
        conditions.push(eq(models.detectedType, filters.type));
      }
      if (filters.architecture) {
        conditions.push(eq(models.detectedArchitecture, filters.architecture));
      }
      if (filters.status) {
        conditions.push(eq(models.hashStatus, filters.status));
      }
      if (filters.search) {
        conditions.push(
          or(
            like(models.filename, `%${filters.search}%`),
            like(models.civitaiName, `%${filters.search}%`)
          )
        );
      }

      // Apply conditions
      if (conditions.length > 0) {
        query = query.where(and(...conditions)) as typeof query;
      }

      // Apply pagination
      const limit = filters.limit || 100;
      const offset = filters.offset || 0;
      
      const results = query.limit(limit).offset(offset).all();

      // Count query respects the same filters
      let countQuery = db.select({ count: count() }).from(models);
      if (conditions.length > 0) {
        countQuery = countQuery.where(and(...conditions)) as typeof countQuery;
      }
      const total = countQuery.get()?.count ?? 0;

      return {
        models: results,
        total,
        limit,
        offset,
      };
    }),

  // Get a single model by ID
  get: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(({ input }) => {
      return db.select().from(models).where(eq(models.id, input.id)).get();
    }),

  // Get model statistics
  stats: publicProcedure.query(() => {
    return getModelStats();
  }),

  // Scan models from disk
  scan: publicProcedure
    .input(
      z.object({
        location: z.enum(["local", "warehouse", "all"]).optional(),
        validationLevel: z.enum(["quick", "standard", "full"]).optional(),
        forceRescan: z.boolean().optional(),
      }).optional()
    )
    .mutation(async ({ input }) => {
      const opts = input || {};
      const validationLevel = opts.validationLevel || "standard";
      const forceRescan = opts.forceRescan || false;

      if (opts.location === "local") {
        return scanModelsDirectory(CONFIG.paths.models, {
          location: "local",
          validationLevel,
          forceRescan,
        });
      } else if (opts.location === "warehouse") {
        return scanModelsDirectory(CONFIG.paths.warehouse, {
          location: "warehouse",
          validationLevel,
          forceRescan,
        });
      } else {
        return scanAllModels(validationLevel, forceRescan);
      }
    }),

  // Validate a specific model
  validate: publicProcedure
    .input(
      z.object({
        id: z.string(),
        level: z.enum(["quick", "standard", "full"]).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const model = db.select().from(models).where(eq(models.id, input.id)).get();
      if (!model) {
        throw new Error("Model not found");
      }

      const level = input.level || "standard";
      const analysis = await analyzeModel(model.filepath, {
        calculateFullHash: level === "full",
        calculatePartialHash: level !== "quick",
      });

      if (!analysis) {
        throw new Error("Failed to analyze model");
      }

      // Update model with new validation results
      db.update(models)
        .set({
          hashStatus: analysis.isValid ? "valid" : "corrupt",
          partialHash: analysis.partialHash,
          lastVerifiedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
        .where(eq(models.id, input.id))
        .run();

      return analysis;
    }),

  // Get tree structure of models by path
  tree: publicProcedure
    .input(
      z.object({
        location: z.enum(["local", "warehouse", "all"]).optional(),
        search: z.string().optional(),
        type: z.string().optional(),
      }).optional()
    )
    .query(({ input }) => {
      const filters = input || {};
      let allModels = db.select().from(models).all();

      if (filters.location && filters.location !== "all") {
        allModels = allModels.filter((m) => m.location === filters.location);
      }
      if (filters.type) {
        allModels = allModels.filter((m) => m.detectedType === filters.type);
      }

      const search = filters.search?.toLowerCase();
      let matchingIds: Set<string> | null = null;
      if (search) {
        matchingIds = new Set(
          allModels
            .filter((m) =>
              m.filename.toLowerCase().includes(search) ||
              (m.civitaiName?.toLowerCase().includes(search) ?? false)
            )
            .map((m) => m.id)
        );
        allModels = allModels.filter((m) => matchingIds!.has(m.id));
      }

      type TreeNode = {
        name: string;
        path: string;
        type: "folder" | "file";
        children?: TreeNode[];
        model?: typeof allModels[0];
      };

      const roots: Record<string, TreeNode> = {};

      const addNode = (model: typeof allModels[0]) => {
        const basePath = model.location === "local"
          ? CONFIG.paths.models
          : CONFIG.paths.warehouse;
        const relativePath = model.filepath.replace(basePath, "").replace(/^\//, "");
        const parts = relativePath.split("/");
        let current = roots;
        let fullPath = basePath;

        parts.forEach((part, index) => {
          fullPath = `${fullPath}/${part}`;
          const isFile = index === parts.length - 1;
          const key = `${fullPath}-${isFile ? "file" : "folder"}`;

          if (!current[key]) {
            current[key] = {
              name: part,
              path: fullPath,
              type: isFile ? "file" : "folder",
              children: isFile ? undefined : [],
            };
          }

          if (isFile) {
            current[key].model = model;
          } else {
            const childRecord: Record<string, TreeNode> = {};
            current[key].children?.forEach((child) => {
              childRecord[child.path + child.type] = child;
            });
            current = childRecord;
            current[key] = current[key];
          }
        });
      };

      db.select().from(models).all().forEach((model) => {
        const basePath = model.location === "local"
          ? CONFIG.paths.models
          : CONFIG.paths.warehouse;
        const relativePath = model.filepath.replace(basePath, "").replace(/^\//, "");
        const parts = relativePath.split("/");
        let current = roots;
        let fullPath = basePath;

        parts.forEach((part, index) => {
          fullPath = `${fullPath}/${part}`;
          const isFile = index === parts.length - 1;
          const nodeKey = `${fullPath}-${isFile ? "file" : "folder"}`;
          if (!current[nodeKey]) {
            current[nodeKey] = {
              name: part,
              path: fullPath,
              type: isFile ? "file" : "folder",
              children: isFile ? undefined : [],
            };
          }
          if (isFile && allModels.find((m) => m.filepath === model.filepath)) {
            current[nodeKey].model = model;
          }
          if (!isFile) {
            const childMap: Record<string, TreeNode> = {};
            current[nodeKey].children?.forEach((child) => {
              childMap[child.path + child.type] = child;
            });
            current = childMap;
          }
        });
      });

      const filterTree = (nodes: Record<string, TreeNode>): TreeNode[] => {
        return Object.values(nodes)
          .map((node) => {
            if (node.type === "file") {
              if (!search || matchingIds?.has(node.model?.id || "")) {
                return node;
              }
              return null;
            }
            const childRecord: Record<string, TreeNode> = {};
            node.children?.forEach((child) => {
              childRecord[child.path + child.type] = child;
            });
            const filteredChildren = filterTree(childRecord);
            if (filteredChildren.length > 0) {
              return { ...node, children: filteredChildren };
            }
            return !search ? node : null;
          })
          .filter(Boolean) as TreeNode[];
      };

      return filterTree(roots);
    }),
});
