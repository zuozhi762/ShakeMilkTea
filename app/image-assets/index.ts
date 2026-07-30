export type ImageAssetCategory = "topping" | "ui" | "scene" | "effect";
export type ImageAssetStatus = "planned" | "generated" | "approved";

export type ImageAssetId =
  | "topping-sago"
  | "topping-mango"
  | "topping-coconut"
  | "topping-boba"
  | "topping-red-bean"
  | "topping-pudding"
  | "topping-grass-jelly"
  | "topping-taro-ball"
  | "topping-cheese-foam"
  | "topping-persimmon"
  | "ui-title-badge"
  | "ui-start-button"
  | "ui-leaderboard-medal"
  | "ui-victory-burst"
  | "scene-milk-tea-cup"
  | "scene-tea-surface"
  | "scene-straw"
  | "effect-shake-wave"
  | "effect-suction-ring";

export type ToppingLevel = {
  level: number;
  name: string;
  emoji: string;
  scale: number;
  color: string;
  assetId: ImageAssetId;
};

export type ImageAssetDefinition = {
  id: ImageAssetId;
  category: ImageAssetCategory;
  name: string;
  usage: string;
  fileName: string;
  status: ImageAssetStatus;
  promptSubject: string;
  canvasRole?: "ingredient" | "cup" | "straw" | "effect";
};

export const GENERATED_ASSET_BASE = "/generated-assets";

export const REFERENCE_STYLE_PROFILE = {
  name: "kawaii scrapbook milk-tea watercolor",
  source: "user-provided reference image",
  description:
    "A refined kawaii scrapbook and hand-account sticker style with pastel colors, warm brown pencil linework, cream paper texture, grid-paper composition, washi tape accents, stitched button borders, translucent cup highlights, and small-game readability.",
  palette: ["#ee9b91", "#aa93d2", "#f3cc86", "#fffaf0", "#6b4a3e", "#b9d9cc"],
  constraints:
    "No brand logos, no readable accidental text, no watermarks, no jagged edges. Keep silhouettes clean enough for a small mobile game canvas.",
} as const;

export const TOPPING_LEVELS = [
  { level: 1, name: "\u897f\u7c73", emoji: "\u25cb", scale: 1.0, color: "#fff8e7", assetId: "topping-sago" },
  { level: 2, name: "\u7ea2\u8c46", emoji: "\u25cf", scale: 1.22, color: "#9b2f2f", assetId: "topping-red-bean" },
  { level: 3, name: "\u6930\u679c\u7c92", emoji: "\u25c7", scale: 1.34, color: "#f8fafc", assetId: "topping-coconut" },
  { level: 4, name: "\u8292\u679c", emoji: "\u25cf", scale: 1.78, color: "#ffd447", assetId: "topping-mango" },
  { level: 5, name: "\u73cd\u73e0", emoji: "\u25cf", scale: 2.15, color: "#211817", assetId: "topping-boba" },
  { level: 6, name: "\u5e03\u4e01", emoji: "\u25a0", scale: 2.58, color: "#f3b347", assetId: "topping-pudding" },
  { level: 7, name: "\u4ed9\u8349", emoji: "\u25a0", scale: 3.51, color: "#3f2925", assetId: "topping-grass-jelly" },
  { level: 8, name: "\u828b\u5706", emoji: "\u25cf", scale: 4.12, color: "#a26be8", assetId: "topping-taro-ball" },
  { level: 9, name: "\u5976\u76d6\u7403", emoji: "\u25d2", scale: 4.6, color: "#ffe2ef", assetId: "topping-cheese-foam" },
  { level: 10, name: "\u67ff\u5b50", emoji: "\u25cf", scale: 5.39, color: "#ff8a1c", assetId: "topping-persimmon" },
] as const satisfies readonly ToppingLevel[];

const toppingAssets: ImageAssetDefinition[] = TOPPING_LEVELS.map((level) => ({
  id: level.assetId,
  category: "topping",
  name: level.name,
  usage: `Level ${level.level} topping sprite, evolution icon, and player collectible`,
  fileName: `${level.assetId}.png`,
  status: "generated",
  promptSubject: `${level.name} milk tea topping, refined kawaii hand-account sticker, readable as a shaped collectible at small size, no circular badge backing`,
  canvasRole: "ingredient",
}));

export const IMAGE_ASSETS = [
  ...toppingAssets,
  {
    id: "ui-title-badge",
    category: "ui",
    name: "Title badge",
    usage: "Decorative title plaque for the start screen",
    fileName: "ui-title-badge.png",
    status: "generated",
    promptSubject: "a playful blank milk tea game title badge with no readable text",
  },
  {
    id: "ui-start-button",
    category: "ui",
    name: "Start button plate",
    usage: "Primary button texture and highlight plate",
    fileName: "ui-start-button.png",
    status: "generated",
    promptSubject: "a glossy rounded stitched start-button plate, blank center, no text",
  },
  {
    id: "ui-leaderboard-medal",
    category: "ui",
    name: "Leaderboard medal",
    usage: "Leaderboard and score decoration",
    fileName: "ui-leaderboard-medal.png",
    status: "generated",
    promptSubject: "a tiny milk-tea themed leaderboard medal icon",
  },
  {
    id: "ui-victory-burst",
    category: "ui",
    name: "Victory burst",
    usage: "Victory result backdrop decoration",
    fileName: "ui-victory-burst.png",
    status: "generated",
    promptSubject: "a celebratory burst behind a persimmon topping, no text",
  },
  {
    id: "scene-milk-tea-cup",
    category: "scene",
    name: "Milk tea cup",
    usage: "Main game cup exterior and texture",
    fileName: "scene-milk-tea-cup.png",
    status: "generated",
    promptSubject: "a detailed transparent milk tea cup sticker, tall cup with cute hand-account style linework, empty center for gameplay",
    canvasRole: "cup",
  },
  {
    id: "scene-tea-surface",
    category: "scene",
    name: "Milk tea surface",
    usage: "Repeating liquid texture inside the cup",
    fileName: "scene-tea-surface.png",
    status: "generated",
    promptSubject: "warm milk tea liquid surface tile with subtle waves and tapioca speckles",
  },
  {
    id: "scene-straw",
    category: "scene",
    name: "Straw",
    usage: "Straw danger event body",
    fileName: "scene-straw.png",
    status: "generated",
    promptSubject: "a detailed pink-and-white striped straw sticker, angled game obstacle with rounded tip and clean silhouette",
    canvasRole: "straw",
  },
  {
    id: "effect-shake-wave",
    category: "effect",
    name: "Shake wave",
    usage: "Creamy liquid motion effect during shake events",
    fileName: "effect-shake-wave.png",
    status: "generated",
    promptSubject: "curved creamy liquid motion streaks for a shaking milk tea cup",
    canvasRole: "effect",
  },
  {
    id: "effect-suction-ring",
    category: "effect",
    name: "Suction ring",
    usage: "Straw warning and suction range decoration",
    fileName: "effect-suction-ring.svg",
    status: "generated",
    promptSubject: "a red-pink suction warning ring with soft hand-painted texture, no text",
    canvasRole: "effect",
  },
] as const satisfies readonly ImageAssetDefinition[];

export type ImageAssetManifest = typeof IMAGE_ASSETS;

export function getAssetUrl(asset: ImageAssetDefinition) {
  if (asset.status === "planned") return null;
  return `${GENERATED_ASSET_BASE}/${asset.fileName}`;
}

export function getAssetById(id: ImageAssetId) {
  return IMAGE_ASSETS.find((asset) => asset.id === id);
}

export function getToppingAsset(level: number) {
  const topping = TOPPING_LEVELS[Math.max(0, Math.min(TOPPING_LEVELS.length - 1, level - 1))];
  return getAssetById(topping.assetId);
}

export function buildImagePrompt(asset: ImageAssetDefinition) {
  return [
    "Use case: stylized-concept",
    `Asset type: ${asset.category} game asset for Shake Milk Tea`,
    `Primary request: ${asset.promptSubject}`,
    "Input image: Image 1 is the visual style reference only.",
    `Style/medium: ${REFERENCE_STYLE_PROFILE.description}`,
    "Composition/framing: centered isolated asset, generous padding, readable at 48px and polished at 256px.",
    "Color palette: pastel peach pink, lavender, cream white, milk-tea caramel, warm brown linework, tiny mint accents.",
    "Materials/textures: watercolor paper texture, crisp cream highlights, thin white sticker border, simple shadowless mobile-game silhouette.",
    `Constraints: ${REFERENCE_STYLE_PROFILE.constraints}`,
    "Avoid: photorealism, messy backgrounds, text, labels, brand marks, watermark, cropped edges.",
  ].join("\n");
}

export function buildPromptBatch() {
  return IMAGE_ASSETS.map((asset) => ({
    id: asset.id,
    fileName: asset.fileName,
    prompt: buildImagePrompt(asset),
  }));
}

