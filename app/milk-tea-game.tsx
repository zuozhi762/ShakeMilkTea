"use client";

import { useEffect, useRef, useState } from "react";
import { IMAGE_ASSETS, TOPPING_LEVELS, getAssetById, getAssetUrl, type ImageAssetId } from "./image-assets";

const WIDTH = 390;
const HEIGHT = 700;
const WORLD_WIDTH = 690;
const WORLD_HEIGHT = 1230;
const VIEW_SCALE = 1.75;
const CUP = { topY: 46, bottomY: 1188, topW: 575, bottomW: 405, centerX: WORLD_WIDTH / 2 };
const CUP_CENTER = { x: CUP.centerX, y: (CUP.topY + CUP.bottomY) / 2 };
const LEADERBOARD_KEY = "shake_milk_tea_leaderboard";
const EDGE_TOUCH_RATIO = 0.35;
const PLAYER_SPEED_MULTIPLIER = 2;
const TXT = {
  defaultName: "\u533f\u540d\u5c0f\u6599",
  defaultHint: "\u6309\u4f4f\u6ed1\u52a8\u63a7\u5236\u65b9\u5411\uff0c\u8ffd\u7740\u5c0f\u6599\u63a2\u7d22\u3002",
  shakeWarn: "\u26a0\ufe0f \u5976\u8336\u8981\u88ab\u5927\u529b\u6447\u5566\uff01",
  shaking: "\u{1f9cb} \u5de6\u53f3\u72c2\u6447\uff01\u6574\u676f\u5c0f\u6599\u90fd\u7529\u8d77\u6765\u4e86\uff01",
  strawWarn: "\u26a0\ufe0f \u5438\u7ba1\u8981\u4e09\u8fde\u6233\u4e0b\u6765\u4e86\uff0c\u770b\u51c6\u8d34\u7eb8\u5708\uff01",
  strawActive: "\u{1f964} \u5438\u7ba1\u659c\u63d2\u8fdb\u6765\u5438\u5c0f\u6599\uff01\u522b\u88ab\u5438\u5230\uff01",
};

const LEVELS = TOPPING_LEVELS;
type AssetImageMap = Partial<Record<ImageAssetId, HTMLImageElement>>;

const assetUrl = (id: ImageAssetId) => {
  const asset = getAssetById(id);
  return asset ? getAssetUrl(asset) : null;
};
const assetImage = (assets: AssetImageMap, id: ImageAssetId) => {
  const image = assets[id];
  return image?.complete && image.naturalWidth > 0 ? image : null;
};

type Status = "menu" | "playing" | "won" | "lost" | "leaderboard";
type EventKind = "idle" | "shakeWarning" | "shaking" | "strawWarning" | "strawActive";
type Topping = { id: number; x: number; y: number; vx: number; vy: number; level: number; radius: number; spin: number };
type Player = { x: number; y: number; vx: number; vy: number; level: number; progress: number; radius: number; carried: number[] };
type StrawStab = { x: number; y: number; fromX: number; fromY: number };
type ActiveEvent = { kind: EventKind; until: number; started: number; x?: number; y?: number; swing?: number; stabs?: StrawStab[]; jabMs?: number };
type Runtime = { running: boolean; startTime: number; lastTime: number; elapsed: number; score: number; highestLevel: number; nextId: number; nextShakeAt: number; nextStrawAt: number; lastSpawnAt: number; lastHudAt: number; player: Player; toppings: Topping[]; target: { x: number; y: number; active: boolean }; joystick: { x: number; y: number; active: boolean }; keys: Set<string>; event: ActiveEvent; camera: { x: number; y: number }; shakeAngle: number; shakePower: number };
type Hud = { level: number; progress: number; score: number; elapsed: number; message: string };
type ScoreRecord = { name: string; score: number; elapsed: number; highestLevel: number; result: "won" | "lost"; date: string };
type FinalStats = Omit<ScoreRecord, "name" | "date"> & { reason: string };
type TouchStick = { pointerId: number; anchorX: number; anchorY: number; lastX: number; lastY: number } | null;

let worldCache: { canvas: HTMLCanvasElement; assetCount: number } | null = null;

const levelInfo = (level: number) => LEVELS[Math.max(0, Math.min(LEVELS.length - 1, level - 1))];
const radiusForLevel = (level: number) => 9 * levelInfo(level).scale;
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const rand = (min: number, max: number) => min + Math.random() * (max - min);
const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
function formatTime(ms: number) { const t = Math.max(0, Math.floor(ms / 1000)); return Math.floor(t / 60).toString().padStart(2, "0") + ":" + (t % 60).toString().padStart(2, "0"); }
function loadLeaderboard(): ScoreRecord[] { if (typeof window === "undefined") return []; try { const raw = window.localStorage.getItem(LEADERBOARD_KEY); return raw ? JSON.parse(raw) as ScoreRecord[] : []; } catch { return []; } }
function sortLeaderboard(records: ScoreRecord[]) { return records.sort((a, b) => a.result !== b.result ? (a.result === "won" ? -1 : 1) : a.highestLevel !== b.highestLevel ? b.highestLevel - a.highestLevel : a.score !== b.score ? b.score - a.score : b.elapsed - a.elapsed).slice(0, 10); }
function saveLeaderboard(record: ScoreRecord) { const next = sortLeaderboard([...loadLeaderboard(), record]); window.localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(next)); return next; }

const cupT = (y: number) => clamp((y - CUP.topY) / (CUP.bottomY - CUP.topY), 0, 1);
function cupHalfWidthAt(y: number) { const t = cupT(y); return CUP.topW / 2 + (CUP.bottomW / 2 - CUP.topW / 2) * t; }
function cupBoundsAt(y: number, radius = 0) { const half = cupHalfWidthAt(y); return { left: CUP.centerX - half + radius, right: CUP.centerX + half - radius }; }
function isInsideCup(x: number, y: number, radius: number) { if (y < CUP.topY + radius || y > CUP.bottomY - radius) return false; const b = cupBoundsAt(y, radius); return x >= b.left && x <= b.right; }
function clampPointToCup(x: number, y: number, radius: number) { const edgeRadius = Math.max(2, radius * EDGE_TOUCH_RATIO); const cy = clamp(y, CUP.topY + edgeRadius, CUP.bottomY - edgeRadius); const b = cupBoundsAt(cy, edgeRadius); return { x: clamp(x, b.left, b.right), y: cy }; }
function randomCupPoint(radius: number) { const y = rand(CUP.topY + radius + 18, CUP.bottomY - radius - 18); const b = cupBoundsAt(y, radius + 14); return { x: rand(b.left, b.right), y }; }
function difficultyStage(elapsed: number, playerLevel: number) { return Math.min(5, Math.max(Math.floor(elapsed / 30000), Math.floor((playerLevel - 1) / 2))); }
function chooseSpawnLevel(playerLevel: number, elapsed = 0) {
  const maxLevel = Math.min(9, playerLevel + 2); const stage = difficultyStage(elapsed, playerLevel), highBoost = stage > 0 ? 2 : 1, lowCut = stage > 0 ? 0.5 : 1;
  const weights = Array.from({ length: maxLevel }, (_, i) => { const level = i + 1; if (level === playerLevel + 2) return (0.7 + stage * 0.7) * highBoost; if (level === playerLevel + 1) return (1.2 + stage * 0.8) * highBoost; if (level === playerLevel) return Math.max(3.0, 4.2 - stage * 0.25); return Math.max(0.45, (2.9 - (playerLevel - level) * 0.35) * lowCut); });
  const total = weights.reduce((s, n) => s + n, 0); let roll = Math.random() * total;
  for (let i = 0; i < weights.length; i += 1) { roll -= weights[i]; if (roll <= 0) return i + 1; }
  return maxLevel;
}
function updateCamera(runtime: Runtime) { const viewW = WIDTH / VIEW_SCALE, viewH = HEIGHT / VIEW_SCALE; runtime.camera.x += (clamp(runtime.player.x - viewW / 2, 0, WORLD_WIDTH - viewW) - runtime.camera.x) * 0.18; runtime.camera.y += (clamp(runtime.player.y - viewH / 2, 0, WORLD_HEIGHT - viewH) - runtime.camera.y) * 0.18; }
function createRuntime(): Runtime {
  const now = performance.now();
  const player: Player = { x: CUP.centerX, y: CUP.bottomY - 160, vx: 0, vy: 0, level: 1, progress: 1, radius: radiusForLevel(1), carried: Array(LEVELS.length + 1).fill(0) };
  const runtime: Runtime = { running: true, startTime: now, lastTime: now, elapsed: 0, score: 0, highestLevel: 1, nextId: 1, nextShakeAt: 8000, nextStrawAt: 18000, lastSpawnAt: 0, lastHudAt: 0, player, toppings: [], target: { x: player.x, y: player.y, active: false }, joystick: { x: 0, y: 0, active: false }, keys: new Set(), event: { kind: "idle", until: 0, started: now }, camera: { x: 0, y: 0 }, shakeAngle: 0, shakePower: 0 };
  updateCamera(runtime); addToppings(runtime, 10, 1); addToppings(runtime, 4, 2); addToppings(runtime, 2, 3); return runtime;
}
function addToppings(runtime: Runtime, count: number, forcedLevel?: number) { for (let i = 0; i < count; i += 1) { const level = forcedLevel ?? chooseSpawnLevel(runtime.player.level, runtime.elapsed), radius = radiusForLevel(level); let point = randomCupPoint(radius); for (let attempts = 0; attempts < 50; attempts += 1) { point = randomCupPoint(radius); if (dist(point, runtime.player) > runtime.player.radius + radius + 55) break; } runtime.toppings.push({ id: runtime.nextId, x: point.x, y: point.y, vx: rand(-52, 52), vy: rand(-52, 52), level, radius, spin: rand(0, Math.PI * 2) }); runtime.nextId += 1; } }
function normalizePlayerInventory(player: Player) {
  const counts = player.carried.slice();
  counts[player.level] = (counts[player.level] ?? 0) + 1;
  for (let level = 1; level < LEVELS.length; level += 1) {
    while ((counts[level] ?? 0) >= 3) {
      counts[level] -= 3;
      counts[level + 1] = (counts[level + 1] ?? 0) + 1;
    }
  }
  let newLevel = player.level;
  for (let level = LEVELS.length; level >= 1; level -= 1) {
    if ((counts[level] ?? 0) > 0) { newLevel = level; break; }
  }
  counts[newLevel] -= 1;
  player.level = newLevel;
  player.radius = radiusForLevel(newLevel);
  player.carried = Array(LEVELS.length + 1).fill(0);
  for (let level = 1; level <= LEVELS.length; level += 1) player.carried[level] = Math.max(0, counts[level] ?? 0);
  player.progress = Math.min(3, 1 + (player.carried[player.level] ?? 0));
}
function eventMessage(event: ActiveEvent) { if (event.kind === "shakeWarning") return TXT.shakeWarn; if (event.kind === "shaking") return TXT.shaking; if (event.kind === "strawWarning") return TXT.strawWarn; if (event.kind === "strawActive") return TXT.strawActive; return TXT.defaultHint; }
function triggerShake(runtime: Runtime, now: number) { runtime.event = { kind: "shakeWarning", until: now + 800, started: now, swing: Math.random() > 0.5 ? 1 : -1 }; }
function strawDifficulty(runtime: Runtime) { return Math.min(1, runtime.elapsed / 155000 + Math.max(0, runtime.player.level - 1) / 18); }
function makeStrawStabs(runtime: Runtime): StrawStab[] {
  const d = strawDifficulty(runtime);
  return [0, 1, 2].map((index) => {
    const y = CUP.topY + 210 + index * 245 + rand(-34, 54);
    const radius = 44;
    const b = cupBoundsAt(y, radius);
    const x = rand(b.left + 20, b.right - 20);
    const side = Math.random() > 0.5 ? 1 : -1;
    return { x, y, fromX: clamp(x - side * (190 - d * 36), CUP.centerX - CUP.topW / 2 - 120, CUP.centerX + CUP.topW / 2 + 120), fromY: CUP.topY - 185 - index * 12 };
  });
}
function triggerStraw(runtime: Runtime, now: number) { const d = strawDifficulty(runtime), stabs = makeStrawStabs(runtime); runtime.event = { kind: "strawWarning", until: now + 1050 - d * 360, started: now, stabs, jabMs: 1120 - d * 480 }; }
function currentStrawStab(runtime: Runtime, now: number) {
  const stabs = runtime.event.stabs ?? [];
  if (stabs.length === 0) return null;
  const jabMs = runtime.event.jabMs ?? 960;
  const elapsed = Math.max(0, now - runtime.event.started);
  const index = Math.min(2, Math.floor(elapsed / jabMs));
  const local = clamp((elapsed - index * jabMs) / jabMs, 0, 1);
  const stab = stabs[index];
  const plunge = local < 0.46 ? local / 0.46 : local < 0.7 ? 1 : 1 - (local - 0.7) / 0.3;
  const eased = plunge < 0.5 ? 2 * plunge * plunge : 1 - Math.pow(-2 * plunge + 2, 2) / 2;
  return { ...stab, index, local, x: stab.fromX + (stab.x - stab.fromX) * eased, y: stab.fromY + (stab.y - stab.fromY) * eased, activeSuction: local > 0.3 && local < 0.78 };
}
function keepInCup(item: { x: number; y: number; vx: number; vy: number; radius: number }) { const oldX = item.x, oldY = item.y; const p = clampPointToCup(item.x, item.y, item.radius); item.x = p.x; item.y = p.y; if (Math.abs(item.x - oldX) > 0.01) item.vx *= -0.72; if (Math.abs(item.y - oldY) > 0.01) item.vy *= -0.72; }
function drawCupPath(ctx: CanvasRenderingContext2D, expand = 0) { const topHalf = CUP.topW / 2 + expand, bottomHalf = CUP.bottomW / 2 + expand; ctx.beginPath(); ctx.moveTo(CUP.centerX - topHalf, CUP.topY - expand); ctx.lineTo(CUP.centerX + topHalf, CUP.topY - expand); ctx.lineTo(CUP.centerX + bottomHalf, CUP.bottomY + expand); ctx.lineTo(CUP.centerX - bottomHalf, CUP.bottomY + expand); ctx.closePath(); }
function drawAssetCentered(ctx: CanvasRenderingContext2D, image: HTMLImageElement, x: number, y: number, width: number, height: number, alpha = 1) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.drawImage(image, x - width / 2, y - height / 2, width, height);
  ctx.restore();
}

function drawAssetBetween(ctx: CanvasRenderingContext2D, image: HTMLImageElement, from: { x: number; y: number }, to: { x: number; y: number }, width: number, extra = 76) {
  const dx = to.x - from.x, dy = to.y - from.y, length = Math.hypot(dx, dy) + extra;
  ctx.save();
  ctx.translate((from.x + to.x) / 2, (from.y + to.y) / 2);
  ctx.rotate(Math.atan2(dy, dx) - Math.PI / 2);
  ctx.drawImage(image, -width / 2, -length / 2, width, length);
  ctx.restore();
}
function drawIngredient(ctx: CanvasRenderingContext2D, item: { x: number; y: number; radius: number; level: number }, isPlayer = false, assets: AssetImageMap = {}) {
  const lv = levelInfo(item.level); ctx.save(); ctx.translate(item.x, item.y);
  const image = assetImage(assets, lv.assetId);
  if (image) {
    const size = item.radius * 3.08;
    if (isPlayer) {
      ctx.shadowColor = "rgba(255, 243, 159, 0.95)";
      ctx.shadowBlur = item.radius * 1.2;
    }
    ctx.drawImage(image, -size / 2, -size / 2, size, size);
  } else {
    ctx.fillStyle = isPlayer ? "rgba(255, 244, 166, 0.58)" : "rgba(255, 255, 255, 0.18)"; ctx.beginPath(); ctx.arc(0, 0, item.radius + (isPlayer ? 9 : 3), 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = isPlayer ? "rgba(255, 255, 255, 0.92)" : "rgba(255, 255, 255, 0.68)"; ctx.beginPath(); ctx.arc(0, 0, item.radius + 2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = lv.color; ctx.beginPath(); ctx.arc(0, 0, item.radius, 0, Math.PI * 2); ctx.fill();
    ctx.font = Math.round(item.radius * 1.55) + "px Apple Color Emoji, Segoe UI Emoji, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(lv.emoji, 0, 1);
  }
  ctx.restore();
}
function drawPlayerWithCarried(ctx: CanvasRenderingContext2D, runtime: Runtime, assets: AssetImageMap) {
  const player = runtime.player; drawIngredient(ctx, player, true, assets);
  const pieces: number[] = []; player.carried.forEach((count, level) => { for (let i = 0; i < count; i += 1) pieces.push(level); });
  const time = runtime.elapsed / 1000;
  pieces.forEach((level, index) => { if (level <= 0) return; const ring = Math.floor(index / 12), slot = index % 12; const angle = slot / 12 * Math.PI * 2 + ring * 0.38 + time * (0.8 + ring * 0.12); const orbit = player.radius + 8 + ring * 8.5 + Math.sin(time * 4.2 + index) * 2.2; const pieceRadius = clamp(radiusForLevel(level) * 0.44, 4.2, Math.max(5.2, player.radius * 0.44)); drawIngredient(ctx, { x: player.x + Math.cos(angle) * orbit, y: player.y + Math.sin(angle) * orbit, level, radius: pieceRadius }, false, assets); });
}
function drawWorldBackground(ctx: CanvasRenderingContext2D) {
  const bg = ctx.createLinearGradient(0, 0, 0, WORLD_HEIGHT); bg.addColorStop(0, "#fff8ee"); bg.addColorStop(0.45, "#ffe5ef"); bg.addColorStop(1, "#dff9ed"); ctx.fillStyle = bg; ctx.fillRect(-200, -200, WORLD_WIDTH + 400, WORLD_HEIGHT + 400);
  ctx.fillStyle = "rgba(255,255,255,0.42)"; for (let i = 0; i < 42; i += 1) { ctx.beginPath(); ctx.arc((i * 83) % WORLD_WIDTH, 42 + ((i * 131) % WORLD_HEIGHT), 2 + (i % 5), 0, Math.PI * 2); ctx.fill(); }
  ctx.strokeStyle = "rgba(255,159,189,0.14)"; ctx.lineWidth = 3;
  for (let line = 0; line < 8; line += 1) { ctx.beginPath(); const y = 110 + line * 145; for (let x = -40; x <= WORLD_WIDTH + 40; x += 36) { const wy = y + Math.sin((x + line * 41) / 31) * 8; if (x === -40) ctx.moveTo(x, wy); else ctx.lineTo(x, wy); } ctx.stroke(); }
}
function getWorldLayer(assets: AssetImageMap) {
  const assetCount = Object.keys(assets).length;
  if (worldCache?.assetCount === assetCount) return worldCache.canvas;
  const canvas = document.createElement("canvas");
  canvas.width = WORLD_WIDTH;
  canvas.height = WORLD_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  drawWorldBackground(ctx);
  drawCupPath(ctx, 12); ctx.fillStyle = "rgba(255,255,255,0.48)"; ctx.fill(); ctx.strokeStyle = "rgba(255,255,255,0.92)"; ctx.lineWidth = 8; ctx.stroke();
  const cupImage = assetImage(assets, "scene-milk-tea-cup");
  if (cupImage) drawAssetCentered(ctx, cupImage, CUP.centerX, CUP_CENTER.y, CUP.topW + 92, CUP.bottomY - CUP.topY + 118, 0.62);
  drawCupPath(ctx); const tea = ctx.createLinearGradient(0, CUP.topY, 0, CUP.bottomY); tea.addColorStop(0, "rgba(255,238,206,0.82)"); tea.addColorStop(0.48, "rgba(232,184,139,0.84)"); tea.addColorStop(1, "rgba(197,145,117,0.86)"); ctx.fillStyle = tea; ctx.fill();
  const teaSurface = assetImage(assets, "scene-tea-surface");
  if (teaSurface) {
    ctx.save(); drawCupPath(ctx); ctx.clip();
    const pattern = ctx.createPattern(teaSurface, "repeat");
    if (pattern) { ctx.globalAlpha = 0.24; ctx.fillStyle = pattern; ctx.fillRect(-280, CUP.topY - 80, WORLD_WIDTH + 560, CUP.bottomY - CUP.topY + 180); }
    ctx.restore();
  }
  worldCache = { canvas, assetCount };
  return canvas;
}
function drawScene(ctx: CanvasRenderingContext2D, runtime: Runtime | null, status: Status, assets: AssetImageMap = {}) {
  ctx.clearRect(0, 0, WIDTH, HEIGHT); const screenBg = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT); screenBg.addColorStop(0, "#fff8fb"); screenBg.addColorStop(0.55, "#ffe7f0"); screenBg.addColorStop(1, "#ddf8ed"); ctx.fillStyle = screenBg; ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.save(); if (runtime) { ctx.scale(VIEW_SCALE, VIEW_SCALE); ctx.translate(-runtime.camera.x, -runtime.camera.y); } else { ctx.translate((WIDTH - WORLD_WIDTH * 0.42) / 2, 35); ctx.scale(0.42, 0.42); }
  ctx.save(); if (runtime) { ctx.translate(CUP_CENTER.x, CUP_CENTER.y); ctx.rotate(runtime.shakeAngle); ctx.translate(-CUP_CENTER.x, -CUP_CENTER.y); }
  ctx.drawImage(getWorldLayer(assets), 0, 0);
  ctx.save(); drawCupPath(ctx); ctx.clip();
  if (runtime) {
    if (runtime.event.kind === "shakeWarning" || runtime.event.kind === "shaking") {
      const waveImage = assetImage(assets, "effect-shake-wave");
      if (waveImage) {
        const alpha = runtime.event.kind === "shaking" ? 0.58 : 0.42;
        for (let i = 0; i < 5; i += 1) drawAssetCentered(ctx, waveImage, CUP.centerX + Math.sin(runtime.elapsed / 120 + i) * 36, CUP.topY + 150 + i * 180, 430, 122, alpha);
      } else {
        ctx.strokeStyle = runtime.event.kind === "shaking" ? "rgba(255,255,255,0.52)" : "rgba(255,224,86,0.7)"; ctx.lineWidth = 8; for (let i = 0; i < 6; i += 1) { ctx.beginPath(); const y = CUP.topY + 120 + i * 160; ctx.moveTo(CUP.centerX - 190, y); ctx.bezierCurveTo(CUP.centerX - 80, y - 80, CUP.centerX + 80, y + 80, CUP.centerX + 190, y); ctx.stroke(); }
      }
    }
    if (runtime.event.kind === "strawWarning" || runtime.event.kind === "strawActive") {
      const ringImage = assetImage(assets, "effect-suction-ring");
      const marks = runtime.event.kind === "strawActive" ? [currentStrawStab(runtime, performance.now())].filter(Boolean) : runtime.event.stabs ?? [];
      marks.forEach((mark, index) => {
        if (!mark) return;
        const alpha = runtime.event.kind === "strawActive" ? 0.78 : 0.44 + index * 0.08;
        if (ringImage) drawAssetCentered(ctx, ringImage, mark.x, mark.y, 138, 138, alpha);
        else { ctx.fillStyle = runtime.event.kind === "strawActive" ? "rgba(255,105,137,0.13)" : "rgba(255,105,137,0.2)"; ctx.beginPath(); ctx.arc(mark.x, mark.y, 94, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = "rgba(255,105,137,0.72)"; ctx.lineWidth = 4; ctx.setLineDash([10, 8]); ctx.beginPath(); ctx.arc(mark.x, mark.y, 54, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]); }
        if (runtime.event.kind === "strawActive") for (let ring = 0; ring < 4; ring += 1) { ctx.strokeStyle = "rgba(255,255,255," + (0.48 - ring * 0.07) + ")"; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(mark.x, mark.y, 38 + ring * 31 + Math.sin(runtime.elapsed / 74 + ring) * 7, 0.15 + ring, Math.PI * 1.7 + ring); ctx.stroke(); }
      });
    }
    runtime.toppings.forEach((item) => drawIngredient(ctx, item, false, assets)); drawPlayerWithCarried(ctx, runtime, assets);
    if (runtime.event.kind === "strawActive") {
      const c = currentStrawStab(runtime, performance.now());
      const strawImage = assetImage(assets, "scene-straw");
      if (c && strawImage) drawAssetBetween(ctx, strawImage, { x: c.fromX, y: c.fromY }, c, 92, 118);
      else if (c) { ctx.save(); ctx.lineCap = "round"; ctx.lineWidth = 24; ctx.strokeStyle = "#ff8fab"; ctx.beginPath(); ctx.moveTo(c.fromX, c.fromY); ctx.lineTo(c.x, c.y); ctx.stroke(); ctx.lineWidth = 8; ctx.strokeStyle = "rgba(255,255,255,0.92)"; ctx.setLineDash([22, 20]); ctx.beginPath(); ctx.moveTo(c.fromX, c.fromY); ctx.lineTo(c.x, c.y); ctx.stroke(); ctx.restore(); }
    }
  } else { const titleImage = assetImage(assets, "ui-title-badge"); if (titleImage) drawAssetCentered(ctx, titleImage, CUP.centerX, CUP_CENTER.y + 20, 210, 210, 0.9); else { ctx.font = "132px sans-serif"; ctx.textAlign = "center"; ctx.fillText("\u{1f9cb}", CUP.centerX, CUP_CENTER.y + 40); } }
  ctx.restore(); ctx.restore(); ctx.restore(); ctx.fillStyle = "rgba(255,159,189,0.12)"; ctx.fillRect(0, HEIGHT - 28, WIDTH, 28); if (status !== "playing") { ctx.fillStyle = "rgba(90,59,70,0.13)"; ctx.fillRect(0, 0, WIDTH, HEIGHT); }
}
function updateRuntime(runtime: Runtime, dt: number, now: number, finish: (result: "won" | "lost", reason: string) => void) {
  runtime.elapsed = now - runtime.startTime; const player = runtime.player; const difficulty = Math.min(runtime.elapsed / 150000, 1), stage = difficultyStage(runtime.elapsed, player.level);
  if (runtime.event.kind === "idle") { if (runtime.elapsed >= runtime.nextShakeAt) triggerShake(runtime, now); else if (runtime.elapsed >= runtime.nextStrawAt) triggerStraw(runtime, now); }
  else if (runtime.event.kind === "shakeWarning" && now >= runtime.event.until) { runtime.event = { ...runtime.event, kind: "shaking", until: now + 1850, started: now }; runtime.shakePower = 1; }
  else if (runtime.event.kind === "shaking" && now >= runtime.event.until) { runtime.score += 100; runtime.event = { kind: "idle", until: 0, started: now }; runtime.nextShakeAt = runtime.elapsed + rand(11000 - difficulty * 3500, 19000 - difficulty * 4500); }
  else if (runtime.event.kind === "strawWarning" && now >= runtime.event.until) { const jabMs = runtime.event.jabMs ?? 960; runtime.event = { ...runtime.event, kind: "strawActive", until: now + jabMs * 3, started: now }; }
  else if (runtime.event.kind === "strawActive" && now >= runtime.event.until) { runtime.score += 260; runtime.event = { kind: "idle", until: 0, started: now }; runtime.nextStrawAt = runtime.elapsed + rand(14500 - difficulty * 4800, 24500 - difficulty * 6500); }
  const keyX = (runtime.keys.has("arrowright") || runtime.keys.has("d") ? 1 : 0) - (runtime.keys.has("arrowleft") || runtime.keys.has("a") ? 1 : 0); const keyY = (runtime.keys.has("arrowdown") || runtime.keys.has("s") ? 1 : 0) - (runtime.keys.has("arrowup") || runtime.keys.has("w") ? 1 : 0); let dirX = runtime.joystick.active ? runtime.joystick.x : keyX, dirY = runtime.joystick.active ? runtime.joystick.y : keyY;
  if (dirX === 0 && dirY === 0 && runtime.target.active) { const dx = runtime.target.x - player.x, dy = runtime.target.y - player.y, len = Math.hypot(dx, dy); if (len > 5) { dirX = dx / len; dirY = dy / len; } } else if (dirX || dirY) { const len = Math.hypot(dirX, dirY); dirX /= len; dirY /= len; }
  const speedPenalty = (levelInfo(player.level).scale - 1) * 14, accel = 840 * PLAYER_SPEED_MULTIPLIER, maxSpeed = (205 - speedPenalty) * PLAYER_SPEED_MULTIPLIER; player.vx += dirX * accel * dt; player.vy += dirY * accel * dt; const pSpeed = Math.hypot(player.vx, player.vy); if (pSpeed > maxSpeed) { player.vx = player.vx / pSpeed * maxSpeed; player.vy = player.vy / pSpeed * maxSpeed; }
  if (runtime.event.kind === "shaking") { const elapsed = now - runtime.event.started, direction = runtime.event.swing ?? 1, pulse = Math.sin(elapsed / 48), swing = direction * pulse; runtime.shakeAngle = swing * 0.18; runtime.shakePower = Math.max(0, 1 - elapsed / 2050); const shakeStrength = 560 + difficulty * 260, lateral = Math.cos(elapsed / 48) * direction; for (const item of [player, ...runtime.toppings]) { const dx = item.x - CUP_CENTER.x, dy = item.y - CUP_CENTER.y, len = Math.max(80, Math.hypot(dx, dy)); const tangentX = -dy / len, tangentY = dx / len, bottomBias = 0.65 + cupT(item.y) * 0.9; item.vx += (tangentX * shakeStrength * swing + lateral * shakeStrength * 0.95) * bottomBias * dt; item.vy += (tangentY * shakeStrength * swing + Math.sin(elapsed / 35) * 170) * bottomBias * dt; } } else { runtime.shakeAngle *= 0.82; runtime.shakePower *= 0.84; }
  if (runtime.event.kind === "strawActive") {
    const c = currentStrawStab(runtime, now);
    if (c?.activeSuction) {
      const dangerRadius = 42 + difficulty * 16 + stage * 4, pullRadius = 190 + difficulty * 58 + stage * 16, pull = 520 + difficulty * 310 + stage * 74, dPlayer = dist(player, c);
      if (dPlayer < dangerRadius + player.radius * 0.55) { finish("lost", "\u4f60\u88ab\u5438\u7ba1\u5438\u8d70\u4e86"); return; }
      if (dPlayer < pullRadius) { const power = (1 - dPlayer / pullRadius) * pull; player.vx += (c.x - player.x) / Math.max(1, dPlayer) * power * dt; player.vy += (c.y - player.y) / Math.max(1, dPlayer) * power * dt; }
      runtime.toppings = runtime.toppings.filter((item) => { const d = dist(item, c); if (d < dangerRadius + item.radius * 0.34) return false; if (d < pullRadius) { const power = (1 - d / pullRadius) * pull * 1.08; item.vx += (c.x - item.x) / Math.max(1, d) * power * dt; item.vy += (c.y - item.y) / Math.max(1, d) * power * dt; } return true; });
    }
  }
  const damping = Math.pow(runtime.event.kind === "shaking" ? 0.965 : 0.91, dt * 60); player.vx *= damping; player.vy *= damping; player.x += player.vx * dt; player.y += player.vy * dt; keepInCup(player);
  for (const item of runtime.toppings) { const wander = 16 + item.level * 2.4; item.vx += Math.cos(now / 620 + item.spin) * wander * dt; item.vy += Math.sin(now / 760 + item.spin) * wander * dt; const maxItemSpeed = runtime.event.kind === "shaking" ? 360 + difficulty * 120 : 58 + item.level * 5 + difficulty * 24, speed = Math.hypot(item.vx, item.vy); if (speed > maxItemSpeed) { item.vx = item.vx / speed * maxItemSpeed; item.vy = item.vy / speed * maxItemSpeed; } item.x += item.vx * dt; item.y += item.vy * dt; keepInCup(item); }
  for (let i = runtime.toppings.length - 1; i >= 0; i -= 1) { const item = runtime.toppings[i]; if (!isInsideCup(item.x, item.y, item.radius)) continue; if (dist(player, item) < player.radius + item.radius * 0.72) { if (item.level > player.level) { finish("lost", "\u649e\u4e0a\u4e86\u66f4\u5927\u7684" + levelInfo(item.level).name); return; } runtime.toppings.splice(i, 1); const oldLevel = player.level; player.carried[item.level] = (player.carried[item.level] ?? 0) + 1; runtime.score += item.level === oldLevel ? item.level * 20 : item.level * 10; normalizePlayerInventory(player); if (player.level > oldLevel) { for (let level = oldLevel + 1; level <= player.level; level += 1) runtime.score += level * 100; runtime.highestLevel = Math.max(runtime.highestLevel, player.level); player.vx *= 0.45; player.vy *= 0.45; if (player.level >= 10) { runtime.score += 3000; finish("won", "\u4f60\u5408\u6210\u4e86\u4f20\u8bf4\u4e2d\u7684\u67ff\u5b50"); return; } } } }
  if (runtime.elapsed - runtime.lastSpawnAt > Math.max(950, 2300 - stage * 260)) { runtime.lastSpawnAt = runtime.elapsed; const desired = 16 + stage * 12 + Math.round(difficulty * 18) + runtime.player.level * 2; if (runtime.toppings.length < desired) addToppings(runtime, Math.min(4 + stage * 3, desired - runtime.toppings.length)); }
  updateCamera(runtime);
}

export function MilkTeaGame() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null); const touchStickRef = useRef<TouchStick>(null); const runtimeRef = useRef<Runtime | null>(null); const assetImagesRef = useRef<AssetImageMap>({}); const [assetRevision, setAssetRevision] = useState(0); const [status, setStatus] = useState<Status>("menu"); const [hud, setHud] = useState<Hud>({ level: 1, progress: 1, score: 0, elapsed: 0, message: TXT.defaultHint }); const [finalStats, setFinalStats] = useState<FinalStats | null>(null); const [leaderboard, setLeaderboard] = useState<ScoreRecord[]>([]); const [playerName, setPlayerName] = useState(TXT.defaultName); const [saved, setSaved] = useState(false);
  const updateTargetFromClient = (clientX: number, clientY: number) => { const canvas = canvasRef.current, runtime = runtimeRef.current; if (!canvas || !runtime || !runtime.running) return; const rect = canvas.getBoundingClientRect(); let x = ((clientX - rect.left) / rect.width) * WIDTH / VIEW_SCALE + runtime.camera.x; let y = ((clientY - rect.top) / rect.height) * HEIGHT / VIEW_SCALE + runtime.camera.y; if (Math.abs(runtime.shakeAngle) > 0.001) { const dx = x - CUP_CENTER.x, dy = y - CUP_CENTER.y, c = Math.cos(-runtime.shakeAngle), s = Math.sin(-runtime.shakeAngle); x = CUP_CENTER.x + dx * c - dy * s; y = CUP_CENTER.y + dx * s + dy * c; } runtime.target = { x, y, active: true }; };
  useEffect(() => {
    let disposed = false;
    IMAGE_ASSETS.forEach((asset) => {
      const url = getAssetUrl(asset);
      if (!url) return;
      const image = new Image();
      image.onload = () => {
        if (disposed) return;
        assetImagesRef.current[asset.id] = image;
        setAssetRevision((value) => value + 1);
      };
      image.src = url;
    });
    return () => { disposed = true; };
  }, []);
  useEffect(() => { setLeaderboard(loadLeaderboard()); }, []);
  useEffect(() => { const down = (e: KeyboardEvent) => { const k = e.key.toLowerCase(); if (["arrowup", "arrowdown", "arrowleft", "arrowright", "w", "a", "s", "d"].includes(k)) { e.preventDefault(); runtimeRef.current?.keys.add(k); } }; const up = (e: KeyboardEvent) => runtimeRef.current?.keys.delete(e.key.toLowerCase()); window.addEventListener("keydown", down); window.addEventListener("keyup", up); return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); }; }, []);
  useEffect(() => { if (status !== "playing") return; const movePointer = (event: PointerEvent) => { if (event.pointerType === "mouse") updateTargetFromClient(event.clientX, event.clientY); }; window.addEventListener("pointermove", movePointer); return () => window.removeEventListener("pointermove", movePointer); }, [status]);
  useEffect(() => { const canvas = canvasRef.current, ctx = canvas?.getContext("2d"); if (!ctx || !canvas) return; let frame = 0; const finish = (result: "won" | "lost", reason: string) => { const runtime = runtimeRef.current; if (!runtime || !runtime.running) return; runtime.running = false; setFinalStats({ result, reason, score: runtime.score, elapsed: runtime.elapsed, highestLevel: runtime.highestLevel }); setSaved(false); setStatus(result); }; const loop = (now: number) => { const runtime = runtimeRef.current; if (!runtime || !runtime.running) return; const dt = Math.min(0.033, Math.max(0.001, (now - runtime.lastTime) / 1000)); runtime.lastTime = now; updateRuntime(runtime, dt, now, finish); drawScene(ctx, runtime, "playing", assetImagesRef.current); if (now - runtime.lastHudAt > 180) { runtime.lastHudAt = now; setHud({ level: runtime.player.level, progress: runtime.player.progress, score: runtime.score, elapsed: runtime.elapsed, message: eventMessage(runtime.event) }); } frame = window.requestAnimationFrame(loop); }; if (status === "playing") frame = window.requestAnimationFrame(loop); else drawScene(ctx, runtimeRef.current, status, assetImagesRef.current); return () => window.cancelAnimationFrame(frame); }, [status, assetRevision]);
  const startGame = () => { const runtime = createRuntime(); runtimeRef.current = runtime; setFinalStats(null); setSaved(false); setHud({ level: 1, progress: 1, score: 0, elapsed: 0, message: TXT.defaultHint }); setStatus("playing"); };
  const openLeaderboard = () => { setLeaderboard(loadLeaderboard()); setStatus("leaderboard"); };
  const handlePointer = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const runtime = runtimeRef.current;
    if (!runtime?.running) return;
    if (event.pointerType !== "touch") {
      if (event.type === "pointerdown") event.currentTarget.setPointerCapture(event.pointerId);
      updateTargetFromClient(event.clientX, event.clientY);
      return;
    }
    event.preventDefault();
    if (event.type === "pointerdown") {
      event.currentTarget.setPointerCapture(event.pointerId);
      touchStickRef.current = { pointerId: event.pointerId, anchorX: event.clientX, anchorY: event.clientY, lastX: event.clientX, lastY: event.clientY };
    }
    const stick = touchStickRef.current;
    if (!stick || stick.pointerId !== event.pointerId) return;
    const maxTravel = 72, deadZone = 6, dx = event.clientX - stick.anchorX, dy = event.clientY - stick.anchorY, distance = Math.hypot(dx, dy);
    runtime.target.active = false;
    if (distance > maxTravel) {
      const keepX = dx / distance * maxTravel;
      const keepY = dy / distance * maxTravel;
      stick.anchorX = event.clientX - keepX;
      stick.anchorY = event.clientY - keepY;
    }
    stick.lastX = event.clientX;
    stick.lastY = event.clientY;
    runtime.joystick = distance <= deadZone ? { x: 0, y: 0, active: true } : { x: dx / distance, y: dy / distance, active: true };
  };
  const stopPointer = (event?: React.PointerEvent<HTMLCanvasElement>) => {
    const runtime = runtimeRef.current;
    if (!runtime) return;
    if (event?.pointerType === "touch") {
      if (touchStickRef.current?.pointerId !== event.pointerId) return;
      touchStickRef.current = null;
      runtime.joystick = { x: 0, y: 0, active: false };
    } else runtime.target.active = false;
  };
  const persistScore = () => { if (!finalStats || saved) return; const next = saveLeaderboard({ name: (playerName.trim() || TXT.defaultName).slice(0, 12), score: finalStats.score, elapsed: finalStats.elapsed, highestLevel: finalStats.highestLevel, result: finalStats.result, date: new Date().toLocaleString("zh-CN") }); setLeaderboard(next); setSaved(true); };
  const current = levelInfo(hud.level), finalLevelName = finalStats ? levelInfo(finalStats.highestLevel).name : current.name;
  const menuBadgeUrl = assetUrl("scene-milk-tea-cup");
  const victoryBurstUrl = assetUrl("topping-persimmon");
  const strawUrl = assetUrl("scene-straw");
  const currentAssetUrl = assetUrl(current.assetId);
  return (
    <main className="game-shell">
      <section className="phone-frame" aria-label="game area"><div className="hud top-hud"><div><small>{"\u5f53\u524d"}</small><strong>{currentAssetUrl ? <img className="hud-icon" src={currentAssetUrl} alt="" /> : current.emoji} {current.name}</strong></div><div><small>{"\u8fdb\u5ea6"}</small><strong>{hud.progress}/3</strong></div><div><small>{"\u65f6\u95f4"}</small><strong>{formatTime(hud.elapsed)}</strong></div></div><canvas ref={canvasRef} width={WIDTH} height={HEIGHT} className="game-canvas" onPointerDown={handlePointer} onPointerMove={handlePointer} onPointerUp={stopPointer} onPointerCancel={stopPointer} aria-label="game canvas" /><div className="hud bottom-hud"><span>{hud.message}</span><b>{hud.score} {"\u5206"}</b></div>
        {status === "menu" && <div className="overlay menu-overlay"><div className="logo-bubble">{menuBadgeUrl ? <img src={menuBadgeUrl} alt="" /> : "\u{1f9cb}"}</div><h2>{"\u51c6\u5907\u5f00\u6447\uff01"}</h2><p>{"\u7535\u8111\u7aef\u7528\u9f20\u6807\u6216 WASD\uff1b\u624b\u673a\u7aef\u50cf\u53ec\u5524\u795e\u9f99\u4e00\u6837\u6309\u4f4f\u5c4f\u5e55\u6ed1\u52a8\uff0c\u7528\u6ed1\u52a8\u65b9\u5411\u63a7\u5236\u6e38\u52a8\u3002\u5438\u7ba1\u4f1a\u4e09\u8fde\u659c\u63d2\uff0c\u522b\u88ab\u5438\u8d70\u3002"}</p><button className="asset-button" onClick={startGame}>{"\u5f00\u59cb\u6e38\u620f"}</button><button className="secondary" onClick={openLeaderboard}>{"\u67e5\u770b\u6392\u884c\u699c"}</button></div>}
        {(status === "won" || status === "lost") && finalStats && <div className={"overlay result-overlay " + (status === "won" ? "win" : "lose")}><div className="logo-bubble">{status === "won" && victoryBurstUrl ? <img src={victoryBurstUrl} alt="" /> : status === "lost" && strawUrl ? <img src={strawUrl} alt="" /> : status === "won" ? "\u{1f7e0}" : "\u{1f964}"}</div><h2>{status === "won" ? "\u8d85\u7ea7\u65e0\u654c\u597d\u559d\u5730\u80dc\u5229\uff01" : "\u8fd9\u676f\u6709\u70b9\u592a\u523a\u6fc0\u4e86"}</h2><p className="reason">{finalStats.reason}</p><div className="stat-grid"><span>{"\u575a\u6301\u65f6\u95f4"} <b>{formatTime(finalStats.elapsed)}</b></span><span>{"\u6700\u9ad8\u7b49\u7ea7"} <b>{finalLevelName}</b></span><span>{"\u6700\u7ec8\u5206\u6570"} <b>{finalStats.score}</b></span></div><label className="name-input">{"\u6392\u884c\u699c\u6635\u79f0"}<input value={playerName} maxLength={12} onChange={(e) => setPlayerName(e.target.value)} /></label><div className="button-row"><button onClick={persistScore} disabled={saved}>{saved ? "\u5df2\u4fdd\u5b58" : "\u4fdd\u5b58\u6210\u7ee9"}</button><button className="secondary" onClick={startGame}>{"\u518d\u6765\u4e00\u5c40"}</button></div><button className="ghost" onClick={openLeaderboard}>{"\u770b\u6392\u884c\u699c"}</button></div>}
        {status === "leaderboard" && <div className="overlay leaderboard-overlay"><h2>{"\u672c\u5730\u6392\u884c\u699c"}</h2>{leaderboard.length === 0 ? <p>{"\u8fd8\u6ca1\u6709\u6210\u7ee9\u3002\u7b2c\u4e00\u676f\u5976\u8336\uff0c\u7b49\u4f60\u6765\u6447\u3002"}</p> : <ol className="leaderboard">{leaderboard.map((r, i) => <li key={r.date + r.score + i}><span className="rank">#{i + 1}</span><span className="record-main"><b>{r.name}</b><small>{r.result === "won" ? "\u80dc\u5229" : "\u5931\u8d25"} / {levelInfo(r.highestLevel).name} / {formatTime(r.elapsed)}</small></span><strong>{r.score}</strong></li>)}</ol>}<div className="button-row"><button className="asset-button" onClick={startGame}>{"\u5f00\u59cb\u6e38\u620f"}</button><button className="secondary" onClick={() => setStatus("menu")}>{"\u8fd4\u56de\u9996\u9875"}</button></div></div>}
      </section>
    </main>
  );
}
