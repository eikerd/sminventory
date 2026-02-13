import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import { db } from "@/server/db";
import { settings } from "@/server/db/schema";
import { eq, inArray } from "drizzle-orm";

const VALID_KEYS = ["civitai_api_key", "huggingface_token", "google_api_key"] as const;

function maskApiKey(value: string): string {
  return value.length > 4
    ? "\u2022".repeat(Math.min(value.length - 4, 20)) + value.slice(-4)
    : "\u2022".repeat(value.length);
}

export const settingsRouter = router({
  // Save any API key by key name
  saveApiKey: publicProcedure
    .input(z.object({
      key: z.enum(VALID_KEYS),
      value: z.string().min(1),
    }))
    .mutation(async ({ input }) => {
      const result = db.insert(settings)
        .values({
          key: input.key,
          value: input.value,
          encrypted: 0,
          updatedAt: new Date().toISOString(),
        })
        .onConflictDoUpdate({
          target: settings.key,
          set: {
            value: input.value,
            updatedAt: new Date().toISOString(),
          },
        })
        .run();

      return { success: result.changes > 0 };
    }),

  // Get a single API key status (masked)
  getApiKey: publicProcedure
    .input(z.object({ key: z.enum(VALID_KEYS) }))
    .query(({ input }) => {
      const setting = db.select().from(settings).where(eq(settings.key, input.key)).get();
      if (!setting?.value) {
        return { exists: false, maskedValue: "" };
      }
      return { exists: true, maskedValue: maskApiKey(setting.value) };
    }),

  // Get status of all configured API keys (single batched query)
  getApiKeys: publicProcedure.query(() => {
    const keys = [...VALID_KEYS];
    const result: Record<string, { exists: boolean; maskedValue: string }> = {};

    // Initialize all keys as not existing
    for (const key of keys) {
      result[key] = { exists: false, maskedValue: "" };
    }

    // Single batched query
    const rows = db.select().from(settings).where(inArray(settings.key, keys)).all();
    for (const row of rows) {
      if (row.value) {
        result[row.key] = { exists: true, maskedValue: maskApiKey(row.value) };
      }
    }

    return result;
  }),
});
