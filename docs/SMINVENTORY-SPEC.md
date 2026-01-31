# Sminventory - Complete Project Specification

> A ComfyUI workflow manager and dependency resolver for Stability Matrix

## 1. Project Vision

**Sminventory** is a workflow-aware dependency manager for **Stability Matrix**, focused on **ComfyUI workflows**.

Think of it as:
> *npm + librarian + disk auditor for Stable Diffusion workflows*

**Core Questions It Answers:**
- "What does this workflow need?"
- "Do I already have it?"
- "Where is it stored?"
- "How big is it?"
- "Can I run this locally or only in the cloud?"

---

## 2. Architecture Overview

```
┌─────────────────────────────────────┐
│     React (Next.js 15 App Router)   │
│     localhost:6660                  │
│     Tailwind CSS 4 + shadcn/ui      │
└───────────────▲─────────────────────┘
                │ tRPC (type-safe RPC)
┌───────────────┴─────────────────────┐
│     Node.js Server                  │
│     tRPC Routers + Services         │
└───────────────▲─────────────────────┘
                │ Drizzle ORM
┌───────────────┴─────────────────────┐
│     SQLite (better-sqlite3)         │
│     ./data/sminventory.db           │
└───────────────▲─────────────────────┘
                │
┌───────────────┴─────────────────────┐
│     File System                     │
│     /mnt/e/ (local - 16GB VRAM)     │
│     /mnt/d/ (warehouse - cloud)     │
└─────────────────────────────────────┘
```

**Key Constraints:**
- No Electron - pure web server
- Local-only web app
- Fast startup
- WSL2 environment with Windows drives mounted

---

## 3. Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 15+ (App Router), React 19, TypeScript |
| Styling | Tailwind CSS 4, shadcn/ui (Radix UI primitives) |
| API | tRPC (type-safe RPC) |
| Database | SQLite via better-sqlite3, Drizzle ORM |
| State | React Query (TanStack Query) |
| Testing | Playwright (E2E) |
| Port | 6660 |

---

## 4. File System Layout

### Storage Locations

| Path | Purpose | Constraint |
|------|---------|------------|
| `/mnt/e/StabilityMatrix/Data/Models` | Local models | 16GB VRAM limit |
| `/mnt/d/models` | Warehouse (cloud/external) | Large FP32 models |
| `/mnt/e/StabilityMatrix/Data/Workflows` | User workflows | - |
| `/mnt/e/StabilityMatrix/Data/Packages/ComfyUI/user/default/workflows` | ComfyUI workflows | - |

### Model Type Directory Mapping

From `extra_model_paths.yaml`:

| Type | Directories |
|------|-------------|
| checkpoint | StableDiffusion |
| lora | Lora, LyCORIS |
| vae | VAE |
| controlnet | ControlNet, T2IAdapter |
| clip | TextEncoders |
| clip_vision | ClipVision |
| upscaler | ESRGAN, RealESRGAN, SwinIR |
| embedding | Embeddings |
| ipadapter | IpAdapter, IpAdapters15, IpAdaptersXl |
| diffusion_model | DiffusionModels |
| ultralytics | Ultralytics |

### Supported File Extensions
`.safetensors`, `.ckpt`, `.pt`, `.pth`, `.bin`, `.gguf`

---

## 5. Database Schema

### `models` - Physical Model Files
```
id (PK)              - SHA256 hash (canonical identity)
filename             - File name
filepath             - Full path
location             - 'local' | 'warehouse'

# Forensics / Identity
detectedType         - checkpoint, lora, vae, controlnet, clip, etc.
detectedArchitecture - SD15, SDXL, Flux, SD3, Pony, unknown
detectedPrecision    - fp16, fp32, fp8, bf16, gguf
fileSize             - Bytes

# Integrity
hashStatus           - valid, corrupt, incomplete, pending
expectedHash         - From .cm-info.json or CivitAI
partialHash          - Quick validation (first+last 10MB)

# CivitAI Identity
civitaiModelId       - CivitAI model ID
civitaiVersionId     - CivitAI version ID
civitaiName          - Display name from CivitAI
civitaiBaseModel     - Base model (SD 1.5, SDXL, etc.)
civitaiDownloadUrl   - Direct download URL

# Embedded Metadata
embeddedMetadata     - JSON blob from safetensor header
triggerWords         - Training trigger words

# Timestamps
createdAt, lastVerifiedAt, updatedAt
```

**Key Insight:** Model IDs are SHA256 hashes - this is the canonical identity, NOT the filename.

### `workflows` - ComfyUI Workflow Files
```
id (PK)              - UUID
filename             - File name
filepath             - Full path
name                 - Display name

# Status
status               - new, scanned-missing-items, scanned-error, 
                       scanned-ready-local, scanned-ready-cloud

# Dependency Summary
totalDependencies    - Count of all dependencies
resolvedLocal        - Count resolved from local storage
resolvedWarehouse    - Count resolved from warehouse
missingCount         - Count of missing models

# Size Estimation
totalSizeBytes       - Sum of all dependency sizes
estimatedVramGb      - VRAM required to run

# Raw Content
rawJson              - Original workflow JSON

# Timestamps
createdAt, scannedAt, updatedAt
```

### `workflowDependencies` - Extracted Model References
```
id (PK)              - Auto-increment
workflowId (FK)      - References workflows

# Node Info
nodeId               - ComfyUI node ID
nodeType             - CheckpointLoaderSimple, LoraLoader, etc.

# Model Reference
modelType            - checkpoint, lora, vae, controlnet, clip, etc.
modelName            - Name as referenced in workflow

# Resolution
resolvedModelId (FK) - References models (if found)
status               - unresolved, resolved-local, resolved-warehouse,
                       missing, ambiguous, incompatible

# For Missing Models
civitaiUrl           - URL to download from CivitAI
huggingfaceUrl       - URL to download from HuggingFace
estimatedSize        - Expected file size

# Compatibility
expectedArchitecture - Expected base model (SD15, SDXL, etc.)
compatibilityIssue   - Description of any mismatch
```

### `executionProfiles` - Hardware Profiles
```
id (PK)              - UUID
name                 - "Local RTX 4080", "Cloud A100", etc.
maxVramGb            - Maximum VRAM available
preferredPrecision   - fp8, fp16, fp32
preferredLocation    - local, warehouse
isDefault            - Boolean
createdAt
```

### `workflowProfileStatus` - Workflow vs Profile Compatibility
```
workflowId (FK)      - References workflows
profileId (FK)       - References executionProfiles
status               - ready, incompatible, oom_risk, missing_deps
estimatedVramGb      - Estimated VRAM for this workflow
issues               - JSON array of compatibility issues
```

### `downloadQueue` - Download Jobs
```
id (PK)              - Auto-increment
workflowId (FK)      - Optional: triggered by workflow
dependencyId (FK)    - Optional: specific dependency

modelName            - Model name
modelType            - Model type
source               - civitai, huggingface, direct
url                  - Download URL
destinationPath      - Where to save

expectedSize         - Expected bytes
expectedHash         - Expected SHA256

status               - queued, downloading, validating, complete, failed, cancelled
progress             - 0-100
downloadedBytes      - Current progress
errorMessage         - If failed

createdAt, startedAt, completedAt
```

### `settings` - Application Settings
```
key (PK)             - Setting name
value                - Setting value
encrypted            - Boolean (for API keys)
updatedAt
```

### `scanLog` - Change Detection
```
id (PK)              - Auto-increment
path                 - Scanned path
fileCount            - Files found
totalSize            - Total bytes
scannedAt
```

---

## 6. tRPC API Structure

### Routers

| Router | Location | Purpose |
|--------|----------|---------|
| `models` | `src/server/api/routers/models.ts` | Model scanning, indexing, forensics |
| `workflows` | `src/server/api/routers/workflows.ts` | Workflow parsing, dependency resolution |
| `civitai` | `src/server/api/routers/civitai.ts` | CivitAI hash lookup and metadata enrichment |

### Client Usage
```typescript
import { trpc } from "@/lib/trpc";

// Inside React component
const { data } = trpc.models.list.useQuery();
const scanMutation = trpc.models.scan.useMutation();
```

### Server Usage
```typescript
import { db } from "@/server/db";
import { models } from "@/server/db/schema";

const allModels = await db.select().from(models);
```

---

## 7. Core Services

### Forensics System (`src/server/services/forensics/`)

Deep analysis of model files:

| Capability | Description |
|------------|-------------|
| Safetensor parsing | Reads JSON header without loading full model |
| Architecture detection | Identifies SD1.5, SDXL, Flux, SD3, Pony from tensor shapes |
| Hash calculation | Full SHA256 + partial hash (first+last 10MB) |
| Metadata extraction | Training info, trigger words, modelspec |

**Usage:**
```typescript
import { analyzeModel, quickScanModel } from "@/server/services/forensics";

// Full analysis
const result = await analyzeModel(filepath, {
  calculateFullHash: true,
  calculatePartialHash: true,
});

// Quick scan (no hash)
const basic = await quickScanModel(filepath);
```

**Confidence Levels:**
- `high` - Definitive match (unique tensor patterns)
- `medium` - Strong indicators but some ambiguity
- `low` - Fallback to filename/path heuristics

### Workflow Parser (`src/server/services/workflow-parser.ts`)

Parses ComfyUI JSON to extract dependencies:

1. Read workflow JSON structure
2. Scan nodes for loader types
3. Extract model names from `widgets_values` or `inputs`
4. Map node types to model types
5. Create dependency records

**ComfyUI Node Mappings:**

| Node Type | Model Type | Field |
|-----------|------------|-------|
| CheckpointLoaderSimple | checkpoint | ckpt_name |
| CheckpointLoader | checkpoint | ckpt_name |
| UNETLoader | diffusion_model | unet_name |
| LoraLoader | lora | lora_name |
| LoraLoaderModelOnly | lora | lora_name |
| VAELoader | vae | vae_name |
| ControlNetLoader | controlnet | control_net_name |
| CLIPLoader | clip | clip_name |
| DualCLIPLoader | clip | clip_name1, clip_name2 |
| CLIPVisionLoader | clip_vision | clip_name |
| UpscaleModelLoader | upscaler | model_name |
| IPAdapterModelLoader | ipadapter | ipadapter_file |

### VRAM Estimator (`src/server/services/vram-estimator.ts`)

Calculates VRAM requirements based on:
- Model types (checkpoint heavier than lora)
- Detected precision (fp16 vs fp32 vs fp8)
- File sizes
- Architecture-specific multipliers

Enables pre-flight checks against execution profiles.

### Model Resolution

Dependencies resolved in order:
1. Local models (`/mnt/e/StabilityMatrix/Data/Models`)
2. Warehouse models (`/mnt/d/models`)
3. CivitAI lookup for missing models

**Resolution Statuses:**
| Status | Meaning |
|--------|---------|
| `unresolved` | Not yet processed |
| `resolved-local` | Found in local storage |
| `resolved-warehouse` | Found in warehouse |
| `missing` | Not found (may have CivitAI URL) |
| `ambiguous` | Multiple matches found |
| `incompatible` | Architecture mismatch |

---

## 8. UI Routes

| Route | Purpose |
|-------|---------|
| `/` | Dashboard/home |
| `/workflows` | Workflow list with status cards |
| `/workflows/[id]` | Workflow detail with dependency graph |
| `/models` | Model inventory |
| `/downloads` | Download queue |
| `/settings` | API keys, execution profiles |

---

## 9. Status Enums

### Workflow Status (`WORKFLOW_STATUS`)
- `new` - Not yet scanned
- `scanned-missing-items` - Scanned, has missing dependencies
- `scanned-error` - Scan failed
- `scanned-ready-local` - All deps available locally
- `scanned-ready-cloud` - All deps available (some in warehouse)

### Hash Status (`HASH_STATUS`)
- `pending` - Not yet calculated
- `valid` - Hash matches expected
- `corrupt` - Hash mismatch
- `incomplete` - Partial hash only
- `unknown` - Cannot determine

### Architectures (`ARCHITECTURES`)
- `SD15` - Stable Diffusion 1.5
- `SDXL` - Stable Diffusion XL
- `SD3` - Stable Diffusion 3
- `Flux` - Flux models
- `Pony` - Pony Diffusion
- `Wan` - Wan models
- `SVD` - Stable Video Diffusion
- `unknown`

---

## 10. CivitAI Integration

Hash lookups require API key stored in `settings` table.

**Process:**
1. Calculate SHA256 hash of model file
2. Query CivitAI API by hash
3. Enrich model record with metadata:
   - modelId, versionId
   - name, baseModel
   - downloadUrl

---

## 11. Development Commands

```bash
# Core
npm run dev          # Start dev server (port 6660)
npm run build        # Production build
npm start            # Production server
npm run lint         # ESLint

# Database
npm run db:generate  # Generate migrations from schema
npm run db:migrate   # Run migrations
npm run db:push      # Push schema directly (dev only)
npm run db:studio    # Drizzle Studio GUI

# Testing
npm run test:e2e     # Playwright E2E tests
```

---

## 12. Development Workflow

When adding new features:

1. **Define schema changes** in `src/server/db/schema.ts`
2. **Generate migration** with `npm run db:generate`
3. **Create/update tRPC router** in `src/server/api/routers/`
4. **Implement business logic** in `src/server/services/`
5. **Build UI** using tRPC hooks in page components
6. **Add E2E tests** in `tests/e2e/`

---

## 13. Key Design Decisions

### Model Identity via SHA256
- Filename is NOT identity (same model, different names)
- SHA256 hash is canonical identity
- Enables duplicate detection across local/warehouse
- Enables "already have this" detection

### Partial Hashing
- Full SHA256 is slow for large models
- Partial hash (first+last 10MB) for quick validation
- Full hash only when needed (CivitAI lookup, verification)

### Two-Tier Storage
- Local: Fast access, limited by VRAM
- Warehouse: Unlimited, slower access
- Models can exist in both locations

### Execution Profiles
- Define hardware constraints (VRAM, precision)
- Pre-flight check before running workflow
- Prevent OOM errors

---

## 14. Future Features (Prioritized)

### High Priority
1. **Garbage Collection** - Reverse dependency graph, orphan detection
2. **Workflow Comparison** - Visual diff between workflows
3. **Smart Download Policies** - Prefer fp16 locally, skip if hash exists

### Medium Priority
4. **Manifest Export/Import** - Offline deployment support
5. **Trust & Provenance** - Track model source, license, verification

### Lower Priority
6. **Multi-user Support** - Profile-based settings
7. **Remote Warehouse Sync** - Cloud storage integration

---

## 15. Performance Considerations

- Model scanning is I/O intensive - use `quickScanModel` for incremental rescans
- Full hash calculation takes seconds per model - only use when needed
- Partial hashes provide fast integrity checks
- Database queries use indexes (idx_models_*, idx_deps_*, etc.)
- Never load entire model files into memory - use streaming/partial reads

---

## 16. Special Notes

### Safetensor Format
- Binary format with JSON header
- Header size in first 8 bytes (little-endian uint64)
- Stream header only, never full file

### ComfyUI Workflow JSON Structure
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

Model names typically in `widgets_values`, sometimes in `inputs`.

### WSL2 Environment
- Windows drives mounted at `/mnt/c/`, `/mnt/d/`, `/mnt/e/`
- Update `src/lib/config.ts` if paths differ

---

## 17. Model Folder Hierarchy (Tree UI Structure)

This section defines the **canonical folder structure** that drives the Tree UI navigation. Models are organized by architecture and purpose, enabling intuitive browsing and compatibility checking.

### Design Philosophy

The structure follows these principles:
- **Architecture-first**: Top-level folders are model architectures (Flux, SDXL, SD15, etc.)
- **Purpose-second**: Subfolders organize by use case (Style, Characters, Fixes)
- **Future-proof**: Includes emerging architectures (SD3, Video models)
- **VRAM-aware**: 16GB local limit means fp8/fp16 preference over fp32

### Checkpoints (`models/checkpoints/`)

```
models/checkpoints/
│
├── Flux/                       # [CURRENT KING]
│   ├── Dev/                    # Flux.1 Dev (fp8 recommended). Best quality.
│   ├── Schnell/                # Flux.1 Schnell. Best speed.
│   └── Finetunes/              # Community versions (Flux Realism, Flux Pro)
│
├── Pony/                       # [ANIME / CARTOON]
│   ├── V6_Based/               # Pony V6 and mixes (AutismMix, SnowPony)
│   └── Realism/                # Pony Realism (Photorealistic Pony models)
│
├── SDXL/                       # [GENERAL PURPOSE]
│   ├── Base/                   # Juggernaut, RealVis, DreamShaper XL
│   ├── Turbo_Lightning/        # Fast models (SDXL Turbo, Lightning 4-step)
│   └── Inpainting/             # Specific models for fixing images
│
├── Z_Image/                    # [SPECIALIZED TURBO]
│   ├── Turbo/                  # Z Image Turbo files
│   └── Base/                   # Z Image Base files
│
├── SD15/                       # [LEGACY & SPEED]
│   ├── Realistic/              # EpicRealism, CyberRealistic
│   ├── Anime/                  # MeinaMix, ToonYou
│   └── Inpainting/             # Crucial for SD1.5 patching
│
├── SD3/                        # [NEW ERA]
│   ├── 3.5_Large/              # The massive new model
│   ├── 3.5_Medium/             # The lighter version
│   └── Turbo/                  # Fast versions
│
├── Video_Models/               # [MOTION GENERATION]
│   ├── SVD/                    # Stable Video Diffusion (Img2Video)
│   ├── WanVideo/               # Wan 2.1 (14GB+ checkpoint)
│   ├── Hunyuan/                # Hunyuan Video checkpoints
│   └── CogVideo/               # CogVideoX checkpoints
│
└── Niche/                      # [EXPERIMENTAL]
    ├── Illustrious/            # New Anime architecture
    ├── PixArt/                 # PixArt Sigma/Alpha
    ├── AuraFlow/
    └── Cascade/                # Stable Cascade
```

### ControlNets (`models/controlnet/`)

```
models/controlnet/
│
├── Flux/                       # [CURRENT KING] Flux.1 Dev/Schnell
│   ├── Canny/
│   ├── Depth/
│   ├── Union/                  # "ProMax" or "Union" (All-in-One)
│   └── InstantX/               # Heavy ControlNets from InstantX team
│
├── SDXL/                       # [WORKHORSE] Standard SDXL 1.0 & Pony
│   ├── Canny/
│   ├── Depth/
│   ├── OpenPose/
│   ├── Lineart/                # Includes Anime Lineart, Sketch, Scribble
│   ├── Recolor/
│   └── T2I_Adapters/           # Lightweight versions (Save VRAM)
│
├── SD15/                       # [LEGACY & SPECIALTY]
│   ├── Canny/
│   ├── OpenPose/
│   ├── Tile/                   # Critical for "Ultimate SD Upscale"
│   ├── Inpaint/
│   ├── Lineart/
│   └── QR_Monster/             # Hidden QR codes/subliminal messages
│
├── SD3/                        # [NEW] For Stable Diffusion 3.5
│   ├── Canny/
│   ├── Depth/
│   └── Pose/
│
└── Video_Specific/             # [MOTION] ControlNets for Video
    ├── SparseCtrl/             # For AnimateDiff (SD1.5). Camera motion.
    ├── Advanced_SVD/           # Stable Video Diffusion controls
    └── Motion_Director/        # Steering video generation
```

### LoRAs (`models/loras/`)

```
models/loras/
│
├── Flux/                       # [THE DAILY DRIVER]
│   ├── Style/                  # Art styles (Oil, Anime, VHS, 3D Render)
│   ├── Characters/             # Specific people or anime characters
│   ├── Clothing/               # Cyberpunk armor, Hoodies, Dresses
│   ├── Concepts/               # Actions (Eating, Running) or Objects (Cars)
│   └── Fixes/                  # "Hands fix", "Skin texture", "Eye detailer"
│
├── Pony/                       # [THE ANIME/ARTIST ENGINE]
│   ├── Styles_Artist/          # Mimicking specific artists
│   ├── Characters/
│   └── Concepts/               # Poses, Backgrounds, Situations
│
├── SDXL/                       # [THE GENERALIST]
│   ├── Style/
│   ├── Architecture/           # Buildings/Interiors (SDXL excels here)
│   └── Effects/                # Lighting, Smoke, Fire, Particles
│
├── SD15/                       # [LEGACY / DAILY DRIVER]
│   ├── Utilities_Tweaks/       # [CRITICAL]
│   │   ├── Detailers/          # "Add More Details", "Eye Enhancer"
│   │   ├── Sliders/            # "Age Slider", "Weight Slider" (LECO)
│   │   └── LCM_Hyper/          # Make SD1.5 run in 4 steps
│   ├── Poses_Action/           # [CRITICAL] Fixing bad anatomy
│   │   ├── Anatomy/            # "POV", "Looking back", "Crossed legs"
│   │   └── Interactions/       # "Eating", "Holding sword", "Hug"
│   ├── Styles/                 # Artist Specific, Aesthetics, Media Type
│   ├── Characters/             # Anime, Games, Real Celebs
│   ├── Clothing/               # Cosplay, Uniforms, Accessories
│   └── Backgrounds/            # Interiors, Nature, City
│
├── Z_Image/                    # [SPECIALIZED]
│   ├── Styles/
│   └── Concepts/
│
├── Video_Generators/           # [THE LAB]
│   ├── WanVideo/               # Wan 2.1 LoRAs
│   ├── Hunyuan/
│   ├── CogVideo/
│   ├── LTX_Video/
│   └── Motion_Specific/        # Camera Controls (Pan, Zoom, Drone Shot)
│
├── SD3_Ecosystem/              # [FUTURE PROOF]
│   ├── SD3_Medium/
│   └── SD3_5_Large/
│
└── Niche_Image/                # [ADVENTUROUS]
    ├── Illustrious/
    ├── PixArt/
    ├── AuraFlow/
    └── NoobAI/
```

### VAE (`models/vae/`)

```
models/vae/
│
├── Flux/                       # [CRITICAL]
│   ├── ae.safetensors          # Standard Flux VAE
│   └── ae_schnell.safetensors  # Rarely needed separate
│
├── SDXL/                       # [CRITICAL]
│   ├── sd_xl_vae.safetensors   # Official SDXL VAE
│   └── fp16_fix.safetensors    # Prevents black images in SDXL
│
├── SD15/                       # [LEGACY]
│   ├── vae-ft-mse-840000       # "Gold Standard" for realism
│   └── anime.vae.pt            # Specific VAEs for old anime models
│
└── Video/                      # [FOR 16GB VRAM]
    ├── wan_2.1_vae.pt          # Wan Video requires its own VAE
    └── svd_xt.safetensors      # Stable Video Diffusion VAE
```

### CLIP Vision (`models/clip_vision/`)

Critical for IP-Adapter (Face ID / Style Transfer):

```
models/clip_vision/
│
├── SDXL/                       # [FOR SDXL IP-ADAPTERS]
│   └── CLIP-ViT-H-14-laion2B-s32B-b79K.safetensors  # "Big H" model
│
├── SD15/                       # [FOR SD1.5 IP-ADAPTERS]
│   └── CLIP-ViT-H-14-laion2B-s32B-b79K.safetensors  # Same name, different file!
│
└── Flux/                       # [NEW]
    └── sigclip_vision_patch14_384.safetensors       # For Flux Redux/IP-Adapter
```

---

## 18. Precision & VRAM Guidelines

### Understanding Precisions

For a 16GB VRAM card, precision choice is critical:

| Precision | File Size (Flux Dev) | VRAM Usage | Recommendation |
|-----------|---------------------|------------|----------------|
| fp32 | ~48GB | Very High | Avoid locally |
| fp16 | ~24GB | High | Avoid for Flux, OK for SDXL |
| fp8 | ~11-16GB | Perfect | **Goldilocks zone** for 16GB |
| GGUF (Q4-Q8) | ~6-10GB | Low | Good for massive models |

### Key Rules

1. **fp8 is your friend** - Download fp8 versions whenever available
2. **fp16 for SDXL** - SDXL fp16 checkpoints (~6GB) fit easily
3. **GGUF for experiments** - Need special "GGUF Loader" nodes
4. **Never fp32 locally** - Spills to system RAM, very slow

### File Placement Examples

| Model | Destination |
|-------|-------------|
| `flux1-dev-fp8.safetensors` | `checkpoints/Flux/Dev/` |
| `Juggernaut_XL_v9.safetensors` | `checkpoints/SDXL/Base/` |
| `PonyDiffusionV6XL.safetensors` | `checkpoints/Pony/V6_Based/` |
| `Wan2.1_T2V_14B_fp16.safetensors` | `checkpoints/Video_Models/WanVideo/` |

---

## 19. Architecture Compatibility Matrix

Understanding which components work together:

| Architecture | LoRAs | ControlNets | VAE | Notes |
|--------------|-------|-------------|-----|-------|
| **Flux** | Flux only | Flux only | Flux ae.safetensors | Incompatible with all others |
| **SDXL** | SDXL + some Pony | SDXL | SDXL VAE | Pony LoRAs often work |
| **Pony** | Pony + SDXL | SDXL | SDXL VAE | Based on SDXL |
| **SD15** | SD15 only | SD15 only | SD15 VAE | Largest LoRA library |
| **SD3** | SD3 only | SD3 only | SD3 VAE | New, limited ecosystem |
| **Z_Image** | Z_Image + some SDXL | SDXL | SDXL VAE | Turbo = different settings |

### Incompatibility Warnings

The Tree UI should warn when:
- SD15 LoRA loaded with SDXL checkpoint
- SDXL VAE used with Flux model (washed out colors)
- SD15 Tile ControlNet used for non-upscale workflow
- Z_Image Turbo with standard SDXL settings (CFG too high = "fried" images)

---

## 20. Tree UI Implementation Notes

### Folder as Category

Each folder in the hierarchy represents a **filterable category** in the UI:
- Clicking `Flux/` shows all Flux models
- Clicking `Flux/Style/` shows Flux style LoRAs
- Breadcrumb navigation: `LoRAs > Flux > Style`

### Status Indicators per Folder

Each folder node should show:
- Total model count
- Total size (GB)
- Architecture badge (Flux, SDXL, SD15, etc.)

### Special Folder Behaviors

| Folder | Special Behavior |
|--------|------------------|
| `Utilities_Tweaks/` | Show "Essential" badge - used almost every generation |
| `Fixes/` | Show "Recommended" when hands/eyes detected in workflow |
| `Turbo_Lightning/` | Warn about sampler settings (CFG 1-2, Steps 4-8) |
| `Video_Specific/` | Show "Motion" badge, warn about incompatibility with image workflows |

### Naming Convention Display

LoRA trigger words embedded in filenames should be parsed and displayed:
- Filename: `Flux_Realism_v2_(rlstc).safetensors`
- Display: `Flux Realism v2` with trigger word badge: `rlstc`

---

## 21. SD15 Special Handling

SD1.5 has the **largest LoRA library** (tens of thousands) and requires deeper organization than other architectures.

### Why SD15 is Different

1. **Less "smart"** - Needs specific LoRAs to fix hands, force poses, add details
2. **Utility LoRAs essential** - `Add_More_Details.safetensors` used almost every generation
3. **Slider LoRAs** - LECO sliders (age, weight) don't exist for Flux yet
4. **LCM acceleration** - `LCM_LoRA.safetensors` enables 4-8 step generation

### Critical SD15 Folders

| Folder | Why It's Critical |
|--------|-------------------|
| `Utilities_Tweaks/Detailers/` | Sharpness, detail enhancement |
| `Utilities_Tweaks/LCM_Hyper/` | Speed optimization |
| `Poses_Action/Anatomy/` | Fix bad hands, poses |
| `Tile/` (ControlNet) | Best way to upscale to 4K |

### UI Recommendations for SD15

- Show "Utility" badge on `Utilities_Tweaks/` folder
- Auto-suggest `Add_More_Details` when SD15 workflow detected
- Warn if no VAE selected (SD15 needs `vae-ft-mse-840000`)

---

## 22. Workflow Spreadsheet View (Main Interface)

The workflows page uses a **smart spreadsheet layout** instead of card boxes for high-density data display.

### Design Principles

- **High-density**: Show maximum information in minimal space
- **Visual health indicators**: Color-coded status at a glance
- **Scannable**: Problems (missing models) draw the eye immediately
- **Actionable**: Inline actions without page navigation

### Visual Aesthetic

| Element | Value |
|---------|-------|
| Background | Deep matte black `#0d0d0d` |
| Row borders | Very thin, dark grey |
| Row hover | Subtle purple glow (brand color) |
| Typography | Monospace for Size and Missing counts |
| Action icons | Muted until row hover |

### Column Specification

| Column | Type | Description |
|--------|------|-------------|
| Selection | Checkbox | Bulk scanning/downloading |
| Workflow Name | Text + Icon | Includes type icon (Image/Video/Upscale) |
| Health Status | Colored Dot | Green=Ready, Amber=Incomplete, Gray=Not scanned |
| Dependencies | Progress Bar | Slim horizontal bar + "X/Y" count |
| Missing | Amber Badge | `! N` only shown if models missing |
| Size | Monospace | Right-aligned, auto-formatting (MB/GB) |
| Last Scanned | Relative Time | "2h ago" or "Never" |
| Actions | Icon Group | View, Rescan, Download (reveal on hover) |

### Health Status Colors

| Color | Status | Meaning |
|-------|--------|---------|
| `bg-emerald-500` | Ready | All dependencies present |
| `bg-amber-500` | Incomplete | Models missing but scanned |
| `bg-gray-400` | Unknown | Not yet scanned |
| `bg-red-500` | Error | Scan failed |

### Quick Filter Pills

Pill-shaped toggles in the header bar:
- **All** - Show all workflows
- **Missing Models** - Filter to incomplete workflows
- **Not Scanned** - Filter to new/unscanned
- **Ready to Run** - Filter to complete workflows

### Row Behaviors

| Behavior | Description |
|----------|-------------|
| Conditional Formatting | Missing models = amber text, Ready = bright white |
| Inline Scan | Refresh icon triggers spinner, updates in-place |
| Expandable Rows | Click workflow name to show dependency sub-panel |
| Sticky Header | Column headers fixed during scroll |

### Workflow Type Icons

Detected from filename heuristics:
- `Film` icon (purple) - Contains "video", "animate", "wan"
- `Wand2` icon (blue) - Contains "upscale", "tile"
- `Image` icon (gray) - Default for image generation

### Action Icons

| Icon | Action | Behavior |
|------|--------|----------|
| Eye | View | Navigate to workflow detail page |
| RefreshCw | Rescan | Re-resolve dependencies |
| Download | Download Missing | Queue missing models (disabled if none) |

### Global Actions (Top Right)

- **Scan All** - Discover new workflows and parse dependencies
- **Download Missing** - Queue downloads for all missing models
