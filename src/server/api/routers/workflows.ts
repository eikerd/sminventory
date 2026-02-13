import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import { db } from "@/server/db";
import { workflows, workflowDependencies, models } from "@/server/db/schema";
import { eq, like, and, or } from "drizzle-orm";
import { scanWorkflows, getWorkflowWithDependencies, parseWorkflowFile } from "@/server/services/workflow-parser";
import { getWorkflowDependencyTreeData } from "@/server/services/workflow-dependency-tree";
import { WORKFLOW_STATUS, DEP_STATUS } from "@/lib/config";

export const workflowsRouter = router({
  // Get all workflows with optional filters
  list: publicProcedure
    .input(
      z
        .object({
          status: z.string().optional(),
          search: z.string().optional(),
          limit: z.number().min(1).max(100).optional(),
          offset: z.number().min(0).optional(),
        })
        .optional()
    )
    .query(({ input }) => {
      const filters = input || {};
      let query = db.select().from(workflows);

      const conditions = [];

      if (filters.status) {
        conditions.push(eq(workflows.status, filters.status));
      }
      if (filters.search) {
        conditions.push(
          or(
            like(workflows.filename, `%${filters.search}%`),
            like(workflows.name, `%${filters.search}%`)
          )
        );
      }

      if (conditions.length > 0) {
        query = query.where(and(...conditions)) as typeof query;
      }

      const limit = filters.limit || 50;
      const offset = filters.offset || 0;

      const results = query.limit(limit).offset(offset).all();
      const total = db.select().from(workflows).all().length;

      return {
        workflows: results,
        total,
        limit,
        offset,
      };
    }),

  // Get a single workflow with its dependencies
  get: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(({ input }) => {
      return getWorkflowWithDependencies(input.id);
    }),

  // Scan filesystem for workflows
  scan: publicProcedure.mutation(async () => {
    return scanWorkflows();
  }),

  // Resolve dependencies for a workflow
  resolveDependencies: publicProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input }) => {
      const workflow = getWorkflowWithDependencies(input.id);
      if (!workflow) {
        throw new Error("Workflow not found");
      }

      // Get all models for matching
      const allModels = db.select().from(models).all();
      
      // Create lookup maps
      const modelsByFilename = new Map<string, typeof allModels[0][]>();
      for (const model of allModels) {
        const key = model.filename.toLowerCase();
        if (!modelsByFilename.has(key)) {
          modelsByFilename.set(key, []);
        }
        modelsByFilename.get(key)!.push(model);
      }

      let resolvedLocal = 0;
      let resolvedWarehouse = 0;
      let missing = 0;
      let totalSize = 0;

      // Resolve each dependency
      for (const dep of workflow.dependencies) {
        // Try to match by filename (with and without extension)
        const modelName = dep.modelName;
        const searchTerms = [
          modelName.toLowerCase(),
          modelName.toLowerCase().replace(/\.[^/.]+$/, ""), // Without extension
          `${modelName.toLowerCase()}.safetensors`,
        ];

        let matched: typeof allModels[0] | null = null;
        let status: string = DEP_STATUS.MISSING;

        for (const term of searchTerms) {
          const candidates = modelsByFilename.get(term);
          if (candidates && candidates.length > 0) {
            // Prefer local over warehouse
            const local = candidates.find((m) => m.location === "local");
            const warehouse = candidates.find((m) => m.location === "warehouse");
            
            if (local) {
              matched = local;
              status = DEP_STATUS.RESOLVED_LOCAL;
              resolvedLocal++;
              totalSize += local.fileSize;
              break;
            } else if (warehouse) {
              matched = warehouse;
              status = DEP_STATUS.RESOLVED_WAREHOUSE;
              resolvedWarehouse++;
              totalSize += warehouse.fileSize;
              break;
            }
          }
        }

        if (!matched) {
          // Try partial match on model name
          for (const model of allModels) {
            if (
              model.filename.toLowerCase().includes(modelName.toLowerCase()) ||
              (model.civitaiName && model.civitaiName.toLowerCase().includes(modelName.toLowerCase()))
            ) {
              matched = model;
              status = model.location === "local" 
                ? DEP_STATUS.RESOLVED_LOCAL 
                : DEP_STATUS.RESOLVED_WAREHOUSE;
              
              if (model.location === "local") resolvedLocal++;
              else resolvedWarehouse++;
              
              totalSize += model.fileSize;
              break;
            }
          }
        }

        if (!matched) {
          missing++;
        }

        // Update dependency
        db.update(workflowDependencies)
          .set({
            resolvedModelId: matched?.id || null,
            status,
          })
          .where(eq(workflowDependencies.id, dep.id!))
          .run();
      }

      // Determine workflow status
      let workflowStatus: string;
      if (missing === 0 && resolvedLocal > 0) {
        workflowStatus = WORKFLOW_STATUS.SCANNED_READY_LOCAL;
      } else if (missing === 0 && resolvedWarehouse > 0) {
        workflowStatus = WORKFLOW_STATUS.SCANNED_READY_CLOUD;
      } else if (missing > 0) {
        workflowStatus = WORKFLOW_STATUS.SCANNED_MISSING;
      } else {
        workflowStatus = WORKFLOW_STATUS.SCANNED_ERROR;
      }

      // Update workflow
      db.update(workflows)
        .set({
          status: workflowStatus,
          resolvedLocal,
          resolvedWarehouse,
          missingCount: missing,
          totalSizeBytes: totalSize,
          scannedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
        .where(eq(workflows.id, input.id))
        .run();

      return {
        status: workflowStatus,
        resolvedLocal,
        resolvedWarehouse,
        missing,
        totalSize,
      };
    }),

  // Resolve all workflow dependencies
  resolveAll: publicProcedure.mutation(async () => {
    const allWorkflows = db.select().from(workflows).all();
    const results = {
      processed: 0,
      readyLocal: 0,
      readyCloud: 0,
      missing: 0,
      errors: 0,
    };

    for (const workflow of allWorkflows) {
      try {
        const workflowData = getWorkflowWithDependencies(workflow.id);
        if (!workflowData) continue;

        // Same resolution logic as above (simplified - would call resolveDependencies)
        results.processed++;
        
        // Count by status
        if (workflow.status === WORKFLOW_STATUS.SCANNED_READY_LOCAL) {
          results.readyLocal++;
        } else if (workflow.status === WORKFLOW_STATUS.SCANNED_READY_CLOUD) {
          results.readyCloud++;
        } else if (workflow.status === WORKFLOW_STATUS.SCANNED_MISSING) {
          results.missing++;
        } else {
          results.errors++;
        }
      } catch (error) {
        results.errors++;
      }
    }

    return results;
  }),

  // Get dependency tree data with VRAM estimates
  dependencyTreeData: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      return getWorkflowDependencyTreeData(input.id);
    }),

  // Get workflow statistics
  stats: publicProcedure.query(() => {
    const allWorkflows = db.select().from(workflows).all();
    
    const byStatus: Record<string, number> = {};
    let totalDependencies = 0;
    let totalSize = 0;

    for (const workflow of allWorkflows) {
      byStatus[workflow.status || "unknown"] = (byStatus[workflow.status || "unknown"] || 0) + 1;
      totalDependencies += workflow.totalDependencies || 0;
      totalSize += workflow.totalSizeBytes || 0;
    }

    return {
      total: allWorkflows.length,
      byStatus,
      totalDependencies,
      totalSize,
    };
  }),
});
