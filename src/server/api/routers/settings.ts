import { z } from "zod";
import { router, publicProcedure } from "../trpc";
import { db } from "@/server/db";
import { settings } from "@/server/db/schema";
import { eq } from "drizzle-orm";

export const settingsRouter = router({
  // Save any API key by key name
  saveApiKey: publicProcedure
    .input(z.object({ key: z.string(), value: z.string().min(1) }))
    .mutation(({ input }) => {
      db.insert(settings)
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

      return { success: true };
    }),

  // Get a single API key status (masked)
  getApiKey: publicProcedure
    .input(z.object({ key: z.string() }))
    .query(({ input }) => {
      const setting = db.select().from(settings).where(eq(settings.key, input.key)).get();
      if (!setting?.value) {
        return { exists: false, maskedValue: "" };
      }
      const val = setting.value;
      const masked = val.length > 4
        ? "\u2022".repeat(Math.min(val.length - 4, 20)) + val.slice(-4)
        : "\u2022".repeat(val.length);
      return { exists: true, maskedValue: masked };
    }),

  // Get status of all configured API keys
  getApiKeys: publicProcedure.query(() => {
    const keys = ["civitai_api_key", "huggingface_token", "google_api_key"];
    const result: Record<string, { exists: boolean; maskedValue: string }> = {};

    for (const key of keys) {
      const setting = db.select().from(settings).where(eq(settings.key, key)).get();
      if (setting?.value) {
        const val = setting.value;
        const masked = val.length > 4
          ? "\u2022".repeat(Math.min(val.length - 4, 20)) + val.slice(-4)
          : "\u2022".repeat(val.length);
        result[key] = { exists: true, maskedValue: masked };
      } else {
        result[key] = { exists: false, maskedValue: "" };
      }
    }

    return result;
  }),
});
