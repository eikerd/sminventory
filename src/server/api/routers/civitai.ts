import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import { db } from "@/server/db";
import { models, settings } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import {
  lookupByHash,
  getModel,
  searchModels,
  identifyModelFile,
  mapCivitAIType,
  mapCivitAIBaseModel,
} from "@/server/services/civitai-client";
import { calculateFullHash } from "@/server/services/forensics";

export const civitaiRouter = router({
  // Look up a model by hash
  lookupByHash: publicProcedure
    .input(z.object({ hash: z.string() }))
    .query(async ({ input }) => {
      return lookupByHash(input.hash);
    }),

  // Get model details by ID
  getModel: publicProcedure
    .input(z.object({ modelId: z.number() }))
    .query(async ({ input }) => {
      return getModel(input.modelId);
    }),

  // Search for models
  search: publicProcedure
    .input(
      z.object({
        query: z.string(),
        limit: z.number().optional(),
        types: z.array(z.string()).optional(),
      })
    )
    .query(async ({ input }) => {
      return searchModels(input.query, {
        limit: input.limit,
        types: input.types,
      });
    }),

  // Identify a model in our database by looking up its hash on CivitAI
  identifyModel: publicProcedure
    .input(z.object({ modelId: z.string() }))
    .mutation(async ({ input }) => {
      const model = db.select().from(models).where(eq(models.id, input.modelId)).get();
      if (!model) {
        throw new Error("Model not found");
      }

      // Need a full hash for CivitAI lookup
      let hash = model.id; // Our ID is the hash if we have it
      
      // If the ID is not a valid SHA256, calculate the full hash
      if (!/^[A-Fa-f0-9]{64}$/.test(hash)) {
        const fullHash = await calculateFullHash(model.filepath);
        if (!fullHash) {
          throw new Error("Could not calculate hash");
        }
        hash = fullHash;
      }

      // Look up on CivitAI
      const result = await identifyModelFile(hash);
      
      if (!result || !result.identified) {
        return { identified: false, model };
      }

      // Update model with CivitAI info
      db.update(models)
        .set({
          civitaiModelId: result.modelId,
          civitaiVersionId: result.versionId,
          civitaiName: result.modelName,
          civitaiBaseModel: result.baseModel,
          civitaiDownloadUrl: result.downloadUrl,
          detectedType: result.type ? mapCivitAIType(result.type) : model.detectedType,
          detectedArchitecture: result.baseModel ? mapCivitAIBaseModel(result.baseModel) : model.detectedArchitecture,
          triggerWords: result.triggerWords?.join(", ") || model.triggerWords,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(models.id, input.modelId))
        .run();

      return {
        identified: true,
        result,
        model: db.select().from(models).where(eq(models.id, input.modelId)).get(),
      };
    }),

  // Batch identify multiple models
  identifyAll: publicProcedure
    .input(
      z.object({
        limit: z.number().optional(),
        onlyUnidentified: z.boolean().optional(),
      }).optional()
    )
    .mutation(async ({ input }) => {
      const opts = input || {};
      let query = db.select().from(models);

      // Only get models without CivitAI info
      if (opts.onlyUnidentified) {
        // Filter for models without civitai info
        const allModels = query.all().filter(m => !m.civitaiModelId);
        const toProcess = allModels.slice(0, opts.limit || 50);
        
        let identified = 0;
        let failed = 0;
        
        for (const model of toProcess) {
          try {
            let hash = model.id;
            if (!/^[A-Fa-f0-9]{64}$/.test(hash)) {
              const fullHash = await calculateFullHash(model.filepath);
              if (!fullHash) {
                failed++;
                continue;
              }
              hash = fullHash;
            }

            const result = await identifyModelFile(hash);
            
            if (result?.identified) {
              db.update(models)
                .set({
                  civitaiModelId: result.modelId,
                  civitaiVersionId: result.versionId,
                  civitaiName: result.modelName,
                  civitaiBaseModel: result.baseModel,
                  civitaiDownloadUrl: result.downloadUrl,
                  detectedType: result.type ? mapCivitAIType(result.type) : model.detectedType,
                  detectedArchitecture: result.baseModel ? mapCivitAIBaseModel(result.baseModel) : model.detectedArchitecture,
                  triggerWords: result.triggerWords?.join(", ") || model.triggerWords,
                  updatedAt: new Date().toISOString(),
                })
                .where(eq(models.id, model.id))
                .run();
              identified++;
            } else {
              failed++;
            }

            // Rate limit - CivitAI has limits
            await new Promise(resolve => setTimeout(resolve, 500));
          } catch (error) {
            console.error(`Failed to identify model ${model.id}:`, error);
            failed++;
          }
        }

        return { processed: toProcess.length, identified, failed };
      }

      return { processed: 0, identified: 0, failed: 0 };
    }),

  // Save API key
  saveApiKey: publicProcedure
    .input(z.object({ apiKey: z.string() }))
    .mutation(async ({ input }) => {
      db.insert(settings)
        .values({
          key: "civitai_api_key",
          value: input.apiKey,
          encrypted: 0, // TODO: Implement encryption
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

  // Check if API key is configured
  hasApiKey: publicProcedure.query(async () => {
    const setting = db.select().from(settings).where(eq(settings.key, "civitai_api_key")).get();
    return { hasKey: !!setting?.value, keyLength: setting?.value?.length || 0 };
  }),
});
