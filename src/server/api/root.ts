import { router } from "./trpc";
import { modelsRouter } from "./routers/models";
import { workflowsRouter } from "./routers/workflows";
import { civitaiRouter } from "./routers/civitai";
import { tasksRouter } from "./routers/tasks";
import { downloadsRouter } from "./routers/downloads";

/**
 * This is the primary router for your server.
 */
export const appRouter = router({
  models: modelsRouter,
  workflows: workflowsRouter,
  civitai: civitaiRouter,
  tasks: tasksRouter,
  downloads: downloadsRouter,
});

// Export type definition of API
export type AppRouter = typeof appRouter;
