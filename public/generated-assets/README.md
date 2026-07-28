Generated image assets for the milk tea game live here.

The source of truth is `app/image-assets/index.ts`:

- `IMAGE_ASSETS` lists every UI, scene, effect, and topping asset.
- `TOPPING_LEVELS` maps gameplay levels to asset ids.
- `buildPromptBatch()` exports prompt text for regenerating the pack from a style reference.

Files in this folder are replaceable. Keep the same filenames when swapping in
AI-generated PNG/WebP/SVG finals so the game can pick them up through the asset
manifest without changing gameplay code.
