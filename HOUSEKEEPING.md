# ⚠️ SECRETS REMOVED - Store in .env.local instead
# Never commit API keys to version control!
Why I added these specific folders:


1. SD3/ (Stable Diffusion 3.5)


- Even though Flux is more popular right now, SD3.5 Large is a very capable model that fits on your 16GB card.

- Stability AI released official ControlNets (Canny, Depth, etc.) for it. If you ever want to try them, they are incompatible with Flux/SDXL, so they need their own home.

2. Video_Specific/SparseCtrl/


- What is it? SparseCtrl is used with AnimateDiff (which generates video using SD1.5 models). It allows you to feed in a "guide video" (like a stick figure walking) and have the AI animate a character following that walk.

- Why separate it? Technically, these are usually SD1.5 files. However, if you put them in the main SD15 folder, you might accidentally try to use them on a still image, which won't work. Keeping "Motion" models separate saves you headaches.

3. SDXL/T2I_Adapters/


- What are they? These are "Mini-ControlNets." They are much smaller files (150MB vs 1.5GB) and use less VRAM.

- Use Case: Since you have 16GB, you can use the full versions. But if you try to stack 3 or 4 ControlNets at once (e.g., Canny + Depth + Pose + Lineart), you might run out of memory. T2I-Adapters are the solution for complex stacking.

4. SD15/Tile/

Z Image Turbo and Z Image Base are listed separately, implying they are treated as a distinct category or a specific optimized format.

Here is where it fits into your "Adventurous but Organized" structure.

What is it?

- Architecture: It is fundamentally based on SDXL technology but optimized for extreme speed (Turbo).

- Use Case: Real-time generation, ultra-fast previews.

- Compatibility: Most SDXL LoRAs might work on it, but it often requires its own specific LoRAs to maintain that "Turbo" speed without breaking.


Z-Image (often referred to as Zovya or the Z-Image series) is actually a specific architecture/ecosystem, usually a derivative or highly modified version of SDXL
Since you are building a "Future Proof" and "Adventurous" setup, do not hide this inside the standard SDXL folder if you plan to use it specifically for its "Z" features.

Why separate it?

1. Workflow differences: Turbo models often require different sampler settings (e.g., CFG 1.0 - 2.0, Steps 4-8) compared to standard SDXL (CFG 7, Steps 20-30).

2. Organization: If you mix Z-Image Turbo files with standard SDXL files, you might accidentally load a Turbo model into a standard workflow and get a "burned" or "fried" looking image because the settings were too high.

Verdict: If you are just experimenting, you can dump it in SDXL/Turbo_Lightning, but since it has its own filter button on Civitai, giving it its own folder models/checkpoints/Z_Image/ is the "Clean" way to do it.

- Crucial for Upscaling. Even if you don't use SD1.5 for generating images, the "ControlNet Tile Upscale" workflow is still one of the best ways to make an image 4K resolution. You will want the SD1.5 Tile model for this.

This structure is robust. It handles the past (SD1.5), the present (Flux/SDXL), the future (SD3), and video (SparseCtrl).


models/controlnet/
│
├── Flux/                     <-- [CURRENT KING] Flux.1 Dev/Schnell
│   ├── Canny/
│   ├── Depth/
│   ├── Union/                <-- "ProMax" or "Union" models (All-in-One)
│   └── InstantX/             <-- Specific heavy ControlNets from InstantX team
│
├── SDXL/                     <-- [WORKHORSE] Standard SDXL 1.0 & Pony
│   ├── Canny/
│   ├── Depth/
│   ├── OpenPose/
│   ├── Lineart/              <-- Includes Anime Lineart, Sketch, Scribble
│   ├── Recolor/
│   └── T2I_Adapters/         <-- Lightweight versions of ControlNets (Save VRAM)
│
├── SD15/                     <-- [LEGACY & SPECIALTY]
│   ├── Canny/
│   ├── OpenPose/
│   ├── Tile/                 <-- Critical for "Ultimate SD Upscale"
│   ├── Inpaint/
│   ├── Lineart/
│   └── QR_Monster/           <-- For making hidden QR codes/subliminal messages
│
├── SD3/                      <-- [NEW] For Stable Diffusion 3.5 (Medium/Large)
│   ├── Canny/
│   ├── Depth/
│   └── Pose/
│
└── Video_Specific/           <-- [MOTION] ControlNets specifically for Video
    ├── SparseCtrl/           <-- For AnimateDiff (SD1.5). Controls camera motion.
    ├── Advanced_SVD/         <-- For Stable Video Diffusion controls
    └── Motion_Director/      <-- For steering video generation




models/checkpoints/
│
├── Flux/                       <-- [CURRENT KING]
│   ├── Dev/                    <-- Put "Flux.1 Dev" (fp8 recommended) here. Best for quality.
│   ├── Schnell/                <-- Put "Flux.1 Schnell" here. Best for speed.
│   └── Finetunes/              <-- Community versions (e.g., "Flux Realism", "Flux Pro").
│
├── Pony/                       <-- [ANIME / CARTOON]
│   ├── V6_Based/               <-- Pony V6 and mixes (AutismMix, SnowPony).
│   └── Realism/                <-- "Pony Realism" (Photorealistic Pony models).
│
├── SDXL/                       <-- [GENERAL PURPOSE]
│   ├── Base/                   <-- Juggernaut, RealVis, DreamShaper XL.
│   ├── Turbo_Lightning/        <-- Fast models (SDXL Turbo, Lightning 4-step).
│   └── Inpainting/             <-- Specific models for fixing images.
│
├── Z_Image/                    <-- [SPECIALIZED TURBO]
│   ├── Turbo/                  <-- Put "Z Image Turbo" files here.
│   └── Base/                   <-- Put "Z Image Base" files here.
│
├── SD15/                       <-- [LEGACY & SPEED]
│   ├── Realistic/              <-- EpicRealism, CyberRealistic.
│   ├── Anime/                  <-- MeinaMix, ToonYou.
│   └── Inpainting/             <-- Crucial for good SD1.5 patching.
│
├── SD3/                        <-- [NEW ERA]
│   ├── 3.5_Large/              <-- The massive new model.
│   ├── 3.5_Medium/             <-- The lighter version.
│   └── Turbo/                  <-- Fast versions.
│
├── Video_Models/               <-- [MOTION GENERATION]
│   ├── SVD/                    <-- Stable Video Diffusion (Img2Video).
│   ├── WanVideo/               <-- Wan 2.1 (The checkpoint file, usually 14GB+).
│   ├── Hunyuan/                <-- Hunyuan Video checkpoints.
│   └── CogVideo/               <-- CogVideoX checkpoints.
│
└── Niche/                      <-- [EXPERIMENTAL]
    ├── Illustrious/            <-- New Anime architecture.
    ├── PixArt/                 <-- PixArt Sigma/Alpha.
    ├── AuraFlow/
    └── Cascade/                <-- Stable Cascade.




    Understanding Precisions (fp16 vs fp8 vs GGUF)


Since you have 16GB of VRAM, you are right on the borderline where you need to make a choice about which files to download.

1. fp16 (Half Precision)


- File Size: Huge (Flux Dev is ~24GB).

- VRAM Usage: High.

- Your 16GB Card: You cannot run Flux fp16 natively. It will spill over into your System RAM and slow down.

- Verdict: Avoid these for Flux. Okay for SDXL.

2. fp8 (8-bit Floating Point)


- File Size: Medium (Flux Dev is ~11GB - 16GB).

- VRAM Usage: Perfect for you.

- Your 16GB Card: This will fit entirely in your VRAM. It runs fast and looks 99.9% as good as fp16.

- Verdict: Download the fp8 versions whenever available. This is your "Goldilocks" zone.

3. GGUF / Quantized (Q4, Q5, Q8)


- File Size: Small (6GB - 10GB).

- What is it? A compression format borrowed from text AI (like LLMs).

- Verdict: Useful if you want to run massive models (like Flux Pro equivalents) but keeping them very fast. You need special "GGUF Loader" nodes in ComfyUI to use these.

Summary of where to put files:

- Downloading flux1-dev-fp8.safetensors? -> Put in models/checkpoints/Flux/Dev/

- Downloading Juggernaut_XL_v9_RunDiffusionPhoto.safetensors? -> Put in models/checkpoints/SDXL/Base/

- Downloading PonyDiffusionV6XL_v6.safetensors? -> Put in models/checkpoints/Pony/V6_Based/

- Downloading Wan2.1_T2V_14B_fp16.safetensors? -> Put in models/checkpoints/Video_Models/WanVideo/

Location: ComfyUI\models\loras\

Naming Tip: Rename lora files to include triggers! Ex: Flux_Realism_(rlstc).safetensors

models/loras/
│
├── Flux/                       <-- [THE DAILY DRIVER]
│   ├── Style/                  <-- Art styles (Oil, Anime, VHS, 3D Render).
│   ├── Characters/             <-- Specific people or anime characters.
│   ├── Clothing/               <-- Cyberpunk armor, Hoodies, Dresses.
│   ├── Concepts/               <-- Actions (Eating, Running) or Objects (Cars).
│   └── Fixes/                  <-- "Hands fix", "Skin texture", "Eye detailer".
│
├── Pony/                       <-- [THE ANIME/ARTIST ENGINE]
│   ├── Styles_Artist/          <-- Mimicking specific artists.
│   ├── Characters/
│   └── Concepts/               <-- Poses, Backgrounds, Situations.
│
├── SDXL/                       <-- [THE GENERALIST]
│   ├── Style/
│   ├── Architecture/           <-- Buildings/Interiors (SDXL is king here).
│   └── Effects/                <-- Lighting, Smoke, Fire, Particles.
│
├── SD15/                       <-- [LEGACY / DAILY DRIVER]
│   ├── Utilities_Tweaks/       <-- [CRITICAL]
│   │   ├── Detailers/          <-- "Add More Details", "Eye Enhancer".
│   │   ├── Sliders/            <-- "Age Slider", "Weight Slider" (LECO).
│   │   └── LCM_Hyper/          <-- Make SD1.5 run in 4 steps.
│   ├── Poses_Action/           <-- [CRITICAL] Fixing bad anatomy.
│   │   ├── Anatomy/            <-- "POV", "Looking back", "Crossed legs".
│   │   └── Interactions/       <-- "Eating", "Holding sword", "Hug".
│   ├── Styles/                 <-- Artist Specific, Aesthetics, Media Type.
│   ├── Characters/             <-- Anime, Games, Real Celebs.
│   ├── Clothing/               <-- Cosplay, Uniforms, Accessories.
│   └── Backgrounds/            <-- Interiors, Nature, City (SD1.5 needs help here).
│
├── Z_Image/                    <-- [SPECIALIZED]
│   ├── Styles/
│   └── Concepts/
│
├── Video_Generators/           <-- [THE LAB]
│   ├── WanVideo/               <-- Wan 2.1 LoRAs.
│   ├── Hunyuan/
│   ├── CogVideo/
│   ├── LTX_Video/
│   └── Motion_Specific/        <-- Camera Controls (Pan Left, Zoom In, Drone Shot).
│
├── SD3_Ecosystem/              <-- [FUTURE PROOF]
│   ├── SD3_Medium/
│   └── SD3_5_Large/
│
└── Niche_Image/                <-- [ADVENTUROUS]
    ├── Illustrious/
    ├── PixArt/
    ├── AuraFlow/
    └── NoobAI/




    2. The "Motion Specific" Folder

In the Video_Generators section, I added Motion_Specific.


- Many new video LoRAs don't change the style, they change the camera.

- Example: Wan2.1_Camera_Zoom_In.safetensors.

- It is helpful to keep these separate from "Style" LoRAs so you know: "This file controls the camera, this file controls the colors."

Pro Tip for the "Adventurous": Renaming with Triggers


Since you are organizing manually, here is the secret to staying sane. When you download a LoRA, rename the file to include the trigger word.

Most LoRAs require a specific word in the prompt (like trg_drl, rlstc_style, etc.) to work. You will forget these.


- Original Name: flux_realism_v2.safetensors

- Your Name: Flux_Realism_v2_(rlstc).safetensors

Now, inside ComfyUI, when you look at the list, the trigger word is staring you right in the face. You don't have to open a web browser to check Civitai.

If you are treating SD1.5 as a daily driver, the organization needs to be much deeper than just "General."

SD1.5 has the largest library of LoRAs in history (tens of thousands). Without structure, it becomes a swamp. Because SD1.5 isn't as "smart" as Flux, you often need specific LoRAs to fix hands, force poses, or add details that Flux does naturally.

Why this specific structure for SD1.5?


1. The Utilities_Tweaks Folder

This is unique to SD1.5. You will use this almost every generation.


- Add_More_Details.safetensors: This is legendary. It forces sharpness into the image.

- LCM_LoRA.safetensors: This allows you to generate images in 4 to 8 steps instead of 20, making generation almost instant on your GPU.

2. The Poses_Action Folder

Flux understands "a girl holding a sword." SD1.5 often fails at this.


- You will download LoRAs specifically named things like holding_weapon_v1.safetensors.

- Grouping these together saves you from having to prompt complex anatomy; you just plug in the LoRA and the pose is fixed.

3. Sliders

SD1.5 has unique "Slider" LoRAs (LECO). You can use these to control age, weight, or breast size with a simple strength number (e.g., -2 to +2). These don't really exist the same way for Flux yet, so keeping them handy in SD1.5 is great.

VAE (Variational AutoEncoder)


Location: ComfyUI\models\vae\

VAE is the "decoder" that turns the AI's math into actual pixels. If you use an SD1.5 VAE on an SDXL image, you get "static/snow." If you use an SDXL VAE on Flux, the colors look washed out or neon.

Do not dump them all in the root. Sort them by the model they belong to.


	models/vae/
	│
	├── Flux/                     <-- [CRITICAL]
	│   ├── ae.safetensors        <-- The standard Flux VAE.
	│   └── ae_schnell.safetensors <-- (Rarely needed separate, but good to have)
	│
	├── SDXL/                     <-- [CRITICAL]
	│   ├── sd_xl_vae.safetensors <-- The official SDXL VAE.
	│   └── fp16_fix.safetensors  <-- The "Fixed" VAE that prevents black images in SDXL.
	│
	├── SD15/                     <-- [LEGACY]
	│   ├── vae-ft-mse-840000     <-- The "Gold Standard" for realism.
	│   └── anime.vae.pt          <-- Specific VAEs for old anime models (rarely used now).
	│
	└── Video/                    <-- [FOR 16GB VRAM]
	    ├── wan_2.1_vae.pt        <-- Wan Video requires its own massive VAE.
	    └── svd_xt.safetensors    <-- Stable Video Diffusion VAE.


- Why organize? In ComfyUI, the VAELoader node lets you select folders. If you keep them separate, you won't accidentally pick the SD1.5 VAE for a Flux generation and wonder why your image looks like a deep-fried meme.

CLIP Vision (models/clip_vision/)


This is CRITICAL for "IP-Adapter" (Face ID / Style Transfer).

If you want to use "IP-Adapter" to copy a face or style, you need the vision models that "see" the reference image.


	models/clip_vision/
	│
	├── SDXL/                     <-- [FOR SDXL IP-ADAPTERS]
	│   └── CLIP-ViT-H-14-laion2B-s32B-b79K.safetensors  <-- The "Big H" model.
	│
	├── SD15/                     <-- [FOR SD1.5 IP-ADAPTERS]
	│   └── CLIP-ViT-H-14-laion2B-s32B-b79K.safetensors  <-- (Same name, different file sometimes!)
	│
	└── Flux/                     <-- [NEW]
	    └── sigclip_vision_patch14_384.safetensors       <-- The specific vision model for Flux Redux/IP-Adapter.


- Why organize? The filenames for CLIP Vision are terrible (e.g., pytorch_model.bin or model.safetensors). You must rename them or put them in folders like SDXL and SD15 so you know which one to load into the IP-Adapter node.

Summary for Stability Matrix Users


If you are using Stability Matrix, it might try to manage these for you. However, CLIP Vision is often a manual download.


1. VAE: Create Flux, SDXL, and SD15 folders.

2. CLIP (Text): Dump them in the root, but keep filenames distinct (t5, clip_l, clip_g).

3. CLIP Vision: Create SDXL and Flux folders. This is vital for maintaining your sanity when doing Face ID work.

