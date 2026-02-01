# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Sminventory** is a ComfyUI workflow manager and dependency resolver for Stability Matrix. It scans local AI model files, analyzes ComfyUI workflows to detect dependencies, resolves model references against local/warehouse storage, and estimates VRAM requirements.

**Tech Stack:** Next.js 15+ (App Router), TypeScript, tRPC, Drizzle ORM, SQLite (better-sqlite3), React Query, Tailwind CSS 4, Radix UI, Playwright (E2E testing)

## ⚠️ CRITICAL RULES FOR ALL AGENTS

### File Commit Rules
**NEVER commit any generated markdown (.md) files without explicit user permission.**

This includes:
- `HANDOFF.md` - Handoff documentation (keep locally only)
- `ROADMAP.md`, `TODO.md`, etc. - Planning documents (ask user first)
- Any other `.md` files generated during the session

Only commit `.md` files that:
1. Are already in the repository (pre-existing)
2. User explicitly requested you to create
3. Are part of the project's documentation (like existing READMEs)

**When in doubt, ask the user before adding any .md file to a commit.**

## Development Commands

### Core Commands
```bash
npm run dev          # Start dev server on port 6660
npm run build        # Production build
npm start            # Production server on port 6660
npm run lint         # Run ESLint
```

### Database Commands
```bash
npm run db:generate  # Generate migrations from schema changes
npm run db:migrate   # Run pending migrations
npm run db:push      # Push schema changes directly (dev only)
npm run db:studio    # Open Drizzle Studio (database GUI)
```

### Testing
```bash
npm run test:e2e     # Run Playwright E2E tests
```

**Note:** The dev server and tests run on port **6660** (not the default 3000).

## Architecture

### tRPC API Structure

The application uses tRPC for type-safe API routes. The API is organized into three routers:

- **`models`** (`src/server/api/routers/models.ts`) - Model scanning, indexing, forensics
- **`workflows`** (`src/server/api/routers/workflows.ts`) - Workflow parsing, dependency resolution
- **`civitai`** (`src/server/api/routers/civitai.ts`) - CivitAI hash lookup and metadata enrichment

All routers are combined in `src/server/api/root.ts` to form the `AppRouter`.

**Client-side usage:**
```typescript
import { trpc } from "@/lib/trpc";

// Inside a React component
const { data } = trpc.models.list.useQuery();
```

**Server-side usage:**
```typescript
import { db } from "@/server/db";
import { models } from "@/server/db/schema";
```

### Database Schema

Located in `src/server/db/schema.ts`. Key tables:

- **`models`** - Physical model files with forensics data (SHA256 ID, detected architecture, CivitAI metadata, hash validation)
- **`workflows`** - ComfyUI workflow files with dependency summaries
- **`workflowDependencies`** - Individual model dependencies extracted from workflows
- **`downloadQueue`** - Download jobs for missing models
- **`executionProfiles`** - User-defined VRAM profiles for compatibility checking
- **`settings`** - Application settings (including encrypted API keys)

**Important:** Model IDs are SHA256 hashes (canonical identity). Use `filepath` for filesystem operations.

### Forensics System

The forensics module (`src/server/services/forensics/`) performs deep analysis of model files:

- **Safetensor parsing** - Reads tensor headers without loading full models
- **Architecture detection** - Identifies SD1.5, SDXL, Flux, SD3, Pony, etc. from tensor shapes
- **Hash calculation** - Supports full SHA256 and partial hashing (first+last 10MB for quick validation)
- **Metadata extraction** - Pulls embedded training info, trigger words, modelspec metadata

**Usage:**
```typescript
import { analyzeModel, quickScanModel } from "@/server/services/forensics";

// Full analysis with hash calculation
const result = await analyzeModel(filepath, {
  calculateFullHash: true,
  calculatePartialHash: true,
});

// Quick scan for basic info only
const basic = await quickScanModel(filepath);
```

### Workflow Parser

Located in `src/server/services/workflow-parser.ts`. Parses ComfyUI JSON workflows to extract model dependencies.

**Key logic:**
1. Reads ComfyUI workflow JSON structure
2. Scans nodes for known loader types (CheckpointLoader, LoraLoader, VAELoader, etc.)
3. Extracts model names from widget values or inputs
4. Maps node types to model types using `NODE_MODEL_MAP`
5. Creates dependency records for resolution

**Supported node types:** See `NODE_MODEL_MAP` in workflow-parser.ts for the complete list.

### Model Resolution

When workflows are scanned, dependencies are resolved against:
1. Local models (`/mnt/e/StabilityMatrix/Data/Models`)
2. Warehouse models (`/mnt/d/models`)
3. CivitAI lookup for missing models

**Resolution statuses** (see `DEP_STATUS` in `src/lib/config.ts`):
- `resolved-local` - Found in local storage
- `resolved-warehouse` - Found in warehouse (cloud/external drive)
- `missing` - Not found, may have CivitAI URL for download
- `ambiguous` - Multiple matches found
- `incompatible` - Architecture mismatch

### VRAM Estimation

`src/server/services/vram-estimator.ts` calculates VRAM requirements based on:
- Model types (checkpoint, lora, vae, controlnet, etc.)
- Detected precision (fp16, fp8, gguf)
- File sizes
- Architecture-specific multipliers

This enables pre-flight checks against execution profiles before running workflows.

### Configuration

`src/lib/config.ts` contains:
- File system paths (Stability Matrix, models, workflows, warehouse, database)
- Model type to directory mappings (from extra_model_paths.yaml)
- Node type to model type mappings
- Supported file extensions
- Status enums (WORKFLOW_STATUS, HASH_STATUS, DEP_STATUS, ARCHITECTURES)

**Important paths:**
- Database: `./data/sminventory.db`
- Models: `/mnt/e/StabilityMatrix/Data/Models`
- Workflows: `/mnt/e/StabilityMatrix/Data/Workflows` and `/mnt/e/StabilityMatrix/Data/Packages/ComfyUI/user/default/workflows`
- Warehouse: `/mnt/d/models`

### UI Components

- **shadcn/ui components** in `src/components/ui/` (Radix UI primitives with Tailwind)
- **Layout components** in `src/components/layout/` (Sidebar, Header)
- **Feature components** in `src/components/` (WorkflowCard, etc.)
- **TRPCProvider** in `src/components/providers.tsx` wraps the app with React Query + tRPC

### App Routes

- `/` - Dashboard/home (table with workflow sorting)
- `/workflows` - Workflow list (auto-redirects to `?view=table`)
- `/workflows/[id]` - Workflow detail with Tree/Table/Graph tabs
- `/models` - Model inventory (table default + card toggle)
- `/downloads` - Download queue (table structure ready)
- `/settings` - Settings (API keys, profiles, view preferences)

## Table-First View System

### Overview
All major pages now default to **sortable table views** instead of card layouts. Users can toggle between views via URL query params (`?view=table` or `?view=cards`).

### Implementation Details

**Core Components:**
- `src/hooks/use-view-mode.ts` - Manages view state via URL params
  - Returns: `{ viewMode: "table" | "cards", setViewMode, isPending }`
  - Defaults to "table"
  - Preserves other query params

- `src/components/ui/view-switcher.tsx` - Toggle component
  - Props: `viewMode`, `onViewChange`, `disabled`, `showCards`
  - Uses Table2 and Grid2x2 icons from lucide-react

- `src/components/ui/data-table.tsx` - Enhanced with sorting
  - Column interface: `{ header, accessor, sortKey?, sortable? }`
  - Client-side sorting with `useMemo` optimization
  - Sort icons: ArrowUpDown (unsorted), ArrowUp (asc), ArrowDown (desc)
  - Supports numeric, string, and date sorting

**Page-Specific Implementation:**

1. **Dashboard** (`src/app/page.tsx`)
   - DataTable for workflows with 6 sortable columns
   - Default sort: `scannedAt` (descending)
   - ViewSwitcher buttons enabled

2. **Workflows** (`src/app/workflows/page.tsx`)
   - Custom table with 5 sortable columns: name, totalDependencies, missingCount, totalSizeBytes, scannedAt
   - Auto-redirects `/workflows` to `/workflows?view=table`
   - Reads `defaultWorkflowView` preference from localStorage
   - Expandable rows, checkboxes, and custom styling preserved

3. **Models** (`src/app/models/page.tsx`)
   - DataTable view (default) with 5 sortable columns
   - Card view available via ViewSwitcher
   - Sortable columns: filename, detectedType, detectedArchitecture, location, fileSize

4. **Workflow Detail** (`src/app/workflows/[id]/page.tsx`)
   - New "Table View" tab alongside Tree and Graph
   - Dependencies table with 5 columns (name, type, status, size, action)
   - Sortable by: modelName, modelType, status, estimatedSize

5. **Downloads** (`src/app/downloads/page.tsx`)
   - Table structure prepared for download queue
   - Columns: modelName, modelType, source, progress, size, speed, actions
   - Ready for backend download manager implementation

**View Preference:**
- Stored in localStorage as `defaultWorkflowView`
- Set in Settings page under "View Preferences"
- Workflows page respects preference: `/workflows` → `/workflows?view=<preference>`

**Sorting Details:**
- All sortable columns have clickable headers with visual indicators
- Headers show arrow icons (↕ unsorted, ↑ asc, ↓ desc) on hover/sort
- Click header to sort, click again to reverse direction
- Works with filters (search, type, location, etc.)

### Testing

**E2E Tests:**
- `tests/e2e/view-switching.spec.ts` - View mode toggling and persistence
- `tests/e2e/table-sorting.spec.ts` - Column sorting and icons
- `tests/e2e/filtering-with-table.spec.ts` - Filtering with table view
- `tests/e2e/table-rendering.spec.ts` - Table structure and rendering

Run tests:
```bash
npm run test:e2e
```

## Testing

E2E tests are in `tests/e2e/`. Playwright config uses:
- Base URL: `http://localhost:6660`
- Auto-starts dev server before tests
- Chromium only (configurable in `playwright.config.ts`)

## Important Notes

### File System Assumptions
The codebase assumes WSL2 environment with Windows drives mounted:
- `/mnt/e/StabilityMatrix` - Main Stability Matrix installation
- `/mnt/d/models` - Warehouse storage (external drive or cloud sync)

Update `src/lib/config.ts` if your paths differ.

### Database Migrations
Always use `npm run db:generate` after schema changes to create migrations. In production, use `npm run db:migrate`. For rapid development, `npm run db:push` can be used but bypasses migration history.

### Model Type Detection
The system uses multiple signals to detect model types:
1. **Path-based** - Directory name (e.g., `/Lora/` → lora)
2. **Tensor-based** - Header analysis (e.g., specific tensor names/shapes)
3. **Filename-based** - Precision detection from filename patterns

### CivitAI Integration
Hash lookups require a CivitAI API key stored in the `settings` table. The system:
1. Calculates SHA256 hash of model file
2. Queries CivitAI API by hash
3. Enriches model record with CivitAI metadata (modelId, versionId, name, baseModel, downloadUrl)

### Architecture Detection Confidence
Forensics results include a confidence level:
- **high** - Definitive match (e.g., unique tensor patterns)
- **medium** - Strong indicators but some ambiguity
- **low** - Fallback to filename/path heuristics

Lower confidence may require manual verification or CivitAI enrichment.

## Workflow Development Pattern

When adding new features:

1. **Define schema changes** in `src/server/db/schema.ts`
2. **Generate migration** with `npm run db:generate`
3. **Create/update tRPC router** in `src/server/api/routers/`
4. **Implement business logic** in `src/server/services/`
5. **Build UI** using tRPC hooks in page components
6. **Add E2E tests** in `tests/e2e/`

Example tRPC procedure:
```typescript
// src/server/api/routers/models.ts
export const modelsRouter = router({
  list: publicProcedure
    .query(async () => {
      return await db.select().from(models).orderBy(desc(models.createdAt));
    }),

  scan: publicProcedure
    .input(z.object({ location: z.enum(["local", "warehouse"]) }))
    .mutation(async ({ input }) => {
      // Implementation
    }),
});
```

## Special Considerations

### Safetensor File Format
Safetensors use a custom binary format with a JSON header. The header size is stored in the first 8 bytes (little-endian uint64). Never load entire model files into memory—use streaming/partial reads.

### Workflow JSON Structure
ComfyUI workflows have a specific structure:
```json
{
  "nodes": [
    {
      "id": 1,
      "type": "CheckpointLoaderSimple",
      "widgets_values": ["model_name.safetensors", ...],
      "inputs": { ... }
    }
  ]
}
```

Model names may be in `widgets_values` (most common) or `inputs` depending on node type.

### Performance
- Model scanning is I/O intensive—use `quickScanModel` for incremental rescans
- Full hash calculation can take seconds per model—only use when needed
- Partial hashes (first+last 10MB) provide fast integrity checks
- Database queries should use indexes defined in schema (idx_models_*, idx_deps_*, etc.)
bat: ERROR TERMINATION at parse_conf.c:1608
Config error: Cannot open config file "/etc/bacula/bat.conf": Permission denied

CRITICAL FILE PATHS - NEVER ASK AGAIN

**Windows Downloads folder (WSL accessible):**
/mnt/c/Users/SUZEEBOX/Downloads/

**When user says 'shot' or provides 'Screenshot' filename:**
- Look for file in: /mnt/c/Users/SUZEEBOX/Downloads/
- Use Read tool to display the image
- Add 'prove_' prefix when saving my analysis screenshots
- NEVER ask for the path again

**Example:** If user says 'Screenshot 2026-01-31 165054'
- Read file: /mnt/c/Users/SUZEEBOX/Downloads/Screenshot 2026-01-31 165054.png
- Analyze it
- Done - no questions
