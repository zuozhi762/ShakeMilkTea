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
  name: "blueberry pastry package illustration",
  source: "user-provided style reference",
  description:
    "A polished editorial food illustration style with saturated cobalt blues, warm pastry golds, cream whites, hand-painted grain, crisp white outlines, subtle print texture, top-down product framing, and a playful premium snack-packaging feel.",
  palette: ["#0f4c81", "#1d5f9f", "#f2a23a", "#fff4d5", "#6b3518", "#f7f1e0"],
  constraints:
    "No brand logos, no readable accidental text, no watermarks. Keep silhouettes clean enough for a small mobile game canvas.",
} as const;

export const TOPPING_LEVELS = [
  { level: 1, name: "西米", emoji: "⚪", scale: 1.0, color: "#fff8e7", assetId: "topping-sago" },
  { level: 2, name: "芒果粒", emoji: "🟨", scale: 1.15, color: "#ffd447", assetId: "topping-mango" },
  { level: 3, name: "椰果粒", emoji: "◻️", scale: 1.3, color: "#f8fafc", assetId: "topping-coconut" },
  { level: 4, name: "珍珠", emoji: "⚫", scale: 1.45, color: "#211817", assetId: "topping-boba" },
  { level: 5, name: "红豆", emoji: "🫘", scale: 1.6, color: "#9b2f2f", assetId: "topping-red-bean" },
  { level: 6, name: "布丁", emoji: "🍮", scale: 1.8, color: "#f3b347", assetId: "topping-pudding" },
  { level: 7, name: "仙草", emoji: "🟫", scale: 2.0, color: "#3f2925", assetId: "topping-grass-jelly" },
  { level: 8, name: "芋圆", emoji: "🟣", scale: 2.25, color: "#a26be8", assetId: "topping-taro-ball" },
  { level: 9, name: "奶盖球", emoji: "🍥", scale: 2.5, color: "#ffe2ef", assetId: "topping-cheese-foam" },
  { level: 10, name: "柿子", emoji: "🟠", scale: 2.8, color: "#ff8a1c", assetId: "topping-persimmon" },
] as const satisfies readonly ToppingLevel[];

const toppingAssets: ImageAssetDefinition[] = TOPPING_LEVELS.map((level) => ({
  id: level.assetId,
  category: "topping",
  name: level.name,
  usage: `游戏内等级 ${level.level} 小料主体、进化路线图标、玩家主体兜底图`,
  fileName: `${level.assetId}.png`,
  status: "generated",
  promptSubject: `${level.name} milk tea topping, readable as a shaped mobile-game collectible at small size, no circular badge backing`,
  canvasRole: "ingredient",
}));

export const IMAGE_ASSETS = [
  ...toppingAssets,
  {
    id: "ui-title-badge",
    category: "ui",
    name: "标题徽章",
    usage: "开始界面游戏标题附近的品牌感装饰",
    fileName: "ui-title-badge.svg",
    status: "generated",
    promptSubject: "a playful milk tea game title badge with no readable text",
  },
  {
    id: "ui-start-button",
    category: "ui",
    name: "开始按钮底图",
    usage: "主按钮纹理或高光切片",
    fileName: "ui-start-button.svg",
    status: "generated",
    promptSubject: "a glossy rounded start-button plate, blank center, no text",
  },
  {
    id: "ui-leaderboard-medal",
    category: "ui",
    name: "排行榜奖牌",
    usage: "排行榜前三名装饰",
    fileName: "ui-leaderboard-medal.svg",
    status: "generated",
    promptSubject: "a tiny milk-tea themed leaderboard medal icon",
  },
  {
    id: "ui-victory-burst",
    category: "ui",
    name: "胜利爆发图",
    usage: "合成柿子胜利弹窗背景",
    fileName: "ui-victory-burst.svg",
    status: "generated",
    promptSubject: "a celebratory burst behind a persimmon topping, no text",
  },
  {
    id: "scene-milk-tea-cup",
    category: "scene",
    name: "奶茶杯",
    usage: "游戏主场景杯体外观",
    fileName: "scene-milk-tea-cup.svg",
    status: "generated",
    promptSubject: "a tall transparent milk tea cup seen from above at a slight angle, empty center for gameplay",
    canvasRole: "cup",
  },
  {
    id: "scene-tea-surface",
    category: "scene",
    name: "奶茶液面",
    usage: "杯内背景液体纹理",
    fileName: "scene-tea-surface.svg",
    status: "generated",
    promptSubject: "warm milk tea liquid surface tile with subtle waves and tapioca speckles",
  },
  {
    id: "scene-straw",
    category: "scene",
    name: "吸管",
    usage: "吸管危险事件主体",
    fileName: "scene-straw.svg",
    status: "generated",
    promptSubject: "a pink-and-white striped straw game obstacle, angled, clean silhouette",
    canvasRole: "straw",
  },
  {
    id: "effect-shake-wave",
    category: "effect",
    name: "摇晃波纹",
    usage: "奶茶杯摇晃提示与进行中效果",
    fileName: "effect-shake-wave.svg",
    status: "generated",
    promptSubject: "curved creamy liquid motion streaks for a shaking milk tea cup",
    canvasRole: "effect",
  },
  {
    id: "effect-suction-ring",
    category: "effect",
    name: "吸力危险圈",
    usage: "吸管预警和吸力范围",
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
    `Use case: stylized-concept`,
    `Asset type: ${asset.category} game asset for 摇摇奶茶大合成`,
    `Primary request: ${asset.promptSubject}`,
    `Input image: Image 1 is the visual style reference only.`,
    `Style/medium: ${REFERENCE_STYLE_PROFILE.description}`,
    `Composition/framing: centered isolated asset, generous padding, readable at 48px and polished at 256px.`,
    `Color palette: cobalt blue accents, warm milk-tea caramel, pastry gold, cream white, dark cocoa linework.`,
    `Materials/textures: hand-painted grain, screen-print speckles, crisp cream highlights, simple shadowless mobile-game silhouette.`,
    `Constraints: ${REFERENCE_STYLE_PROFILE.constraints}`,
    `Avoid: photorealism, messy backgrounds, text, labels, brand marks, watermark, cropped edges.`,
  ].join("\n");
}

export function buildPromptBatch() {
  return IMAGE_ASSETS.map((asset) => ({
    id: asset.id,
    fileName: asset.fileName,
    prompt: buildImagePrompt(asset),
  }));
}
