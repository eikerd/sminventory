import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import { db } from "@/server/db";
import {
  workflowExecutions,
  modelPathHistory,
  workflowDependencies,
  models
} from "@/server/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { existsSync } from "fs";
import { nanoid } from "nanoid";

export const executionsRouter = router({
  // Validate/peek at workflow dependencies to check current model locations
  validateDependencies: publicProcedure
    .input(z.object({ workflowId: z.string() }))
    .mutation(async ({ input }) => {
      const deps = db
        .select()
        .from(workflowDependencies)
        .where(eq(workflowDependencies.workflowId, input.workflowId))
        .all();

      const validationResults = [];
      const now = new Date().toISOString();

      for (const dep of deps) {
        let currentPath: string | null = null;
        let found = false;

        // Check if resolved model exists
        if (dep.resolvedModelId) {
          const model = db
            .select()
            .from(models)
            .where(eq(models.id, dep.resolvedModelId))
            .get();

          if (model) {
            currentPath = model.filepath;
            found = existsSync(currentPath);
          }
        }

        // Update dependency with validation results
        db.update(workflowDependencies)
          .set({
            lastValidatedPath: currentPath,
            lastValidatedAt: now,
          })
          .where(eq(workflowDependencies.id, dep.id))
          .run();

        // Record in path history
        if (currentPath) {
          db.insert(modelPathHistory)
            .values({
              modelId: dep.resolvedModelId!,
              workflowId: input.workflowId,
              usedPath: currentPath,
              pathType: "validation",
              success: found ? 1 : 0,
              notes: found ? "Model found at expected location" : "Model not found at path",
              timestamp: now,
            })
            .run();
        }

        validationResults.push({
          dependencyId: dep.id,
          modelName: dep.modelName,
          found,
          currentPath,
          verifiedWorkingPath: dep.verifiedWorkingPath,
          lastValidatedAt: now,
        });
      }

      return {
        workflowId: input.workflowId,
        validatedAt: now,
        totalDependencies: deps.length,
        foundCount: validationResults.filter(r => r.found).length,
        missingCount: validationResults.filter(r => !r.found).length,
        results: validationResults,
      };
    }),

  // Record a workflow execution result
  recordExecution: publicProcedure
    .input(
      z.object({
        workflowId: z.string(),
        status: z.enum(["success", "failed", "cancelled"]),
        errorMessage: z.string().optional(),
        durationMs: z.number().optional(),
        dependencyPaths: z
          .array(
            z.object({
              dependencyId: z.number(),
              usedPath: z.string(),
              success: z.boolean(),
            })
          )
          .optional(),
      })
    )
    .mutation(async ({ input }) => {
      const now = new Date().toISOString();
      const executionId = nanoid();

      // Create execution record
      db.insert(workflowExecutions)
        .values({
          id: executionId,
          workflowId: input.workflowId,
          status: input.status,
          startedAt: now,
          completedAt: now,
          durationMs: input.durationMs,
          errorMessage: input.errorMessage,
        })
        .run();

      // If successful, update verified working paths
      if (input.status === "success" && input.dependencyPaths) {
        for (const depPath of input.dependencyPaths) {
          if (depPath.success) {
            // Update dependency with verified working path
            db.update(workflowDependencies)
              .set({
                verifiedWorkingPath: depPath.usedPath,
                lastWorkedAt: now,
              })
              .where(eq(workflowDependencies.id, depPath.dependencyId))
              .run();

            // Get model ID for this dependency
            const dep = db
              .select()
              .from(workflowDependencies)
              .where(eq(workflowDependencies.id, depPath.dependencyId))
              .get();

            if (dep?.resolvedModelId) {
              // Record in path history
              db.insert(modelPathHistory)
                .values({
                  modelId: dep.resolvedModelId,
                  workflowId: input.workflowId,
                  executionId,
                  usedPath: depPath.usedPath,
                  pathType: "execution",
                  success: 1,
                  notes: "Verified working path from successful execution",
                  timestamp: now,
                })
                .run();
            }
          }
        }
      }

      return {
        executionId,
        workflowId: input.workflowId,
        status: input.status,
        recordedAt: now,
      };
    }),

  // Get execution history for a workflow
  getExecutionHistory: publicProcedure
    .input(
      z.object({
        workflowId: z.string(),
        limit: z.number().min(1).max(100).default(20),
      })
    )
    .query(({ input }) => {
      return db
        .select()
        .from(workflowExecutions)
        .where(eq(workflowExecutions.workflowId, input.workflowId))
        .orderBy(desc(workflowExecutions.startedAt))
        .limit(input.limit)
        .all();
    }),

  // Get path history for a model
  getModelPathHistory: publicProcedure
    .input(
      z.object({
        modelId: z.string(),
        limit: z.number().min(1).max(100).default(20),
      })
    )
    .query(({ input }) => {
      return db
        .select()
        .from(modelPathHistory)
        .where(eq(modelPathHistory.modelId, input.modelId))
        .orderBy(desc(modelPathHistory.timestamp))
        .limit(input.limit)
        .all();
    }),

  // Get dependency validation status summary
  getDependencyValidationStatus: publicProcedure
    .input(z.object({ workflowId: z.string() }))
    .query(({ input }) => {
      const deps = db
        .select()
        .from(workflowDependencies)
        .where(eq(workflowDependencies.workflowId, input.workflowId))
        .all();

      const now = new Date();
      const validationAgeThresholdMs = 24 * 60 * 60 * 1000; // 24 hours

      return deps.map((dep) => {
        const lastValidatedAt = dep.lastValidatedAt
          ? new Date(dep.lastValidatedAt)
          : null;
        const lastWorkedAt = dep.lastWorkedAt
          ? new Date(dep.lastWorkedAt)
          : null;

        const validationAgeMs = lastValidatedAt
          ? now.getTime() - lastValidatedAt.getTime()
          : null;

        const isStale =
          !validationAgeMs || validationAgeMs > validationAgeThresholdMs;

        return {
          dependencyId: dep.id,
          modelName: dep.modelName,
          modelType: dep.modelType,
          status: dep.status,
          lastValidatedPath: dep.lastValidatedPath,
          lastValidatedAt: dep.lastValidatedAt,
          verifiedWorkingPath: dep.verifiedWorkingPath,
          lastWorkedAt: dep.lastWorkedAt,
          validationAgeMs,
          isStale,
          needsValidation: isStale || !dep.lastValidatedPath,
        };
      });
    }),
});
