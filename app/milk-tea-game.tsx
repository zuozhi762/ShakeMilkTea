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
const LEADERBOARD_API = typeof window === "undefined" ? "" : (window.__MILK_TEA_LEADERBOARD_API__ ?? "/api/leaderboard");
const EDGE_TOUCH_RATIO = 0.35;
const TXT = {
  defaultName: "\u533f\u540d\u5c0f\u6599",
  defaultHint: "\u8ffd\u7740\u5c0f\u6599\u63a2\u7d22\uff0c\u5408\u6210\u66f4\u523a\u6fc0\u7684\u751c\u751c\u5c0f\u6599\u3002",
  shakeWarn: "\u26a0\ufe0f \u5976\u8336\u8981\u88ab\u5927\u529b\u6447\u5566\uff01",
  shaking: "\u{1f9cb} \u5de6\u53f3\u72c2\u6447\uff01\u6574\u676f\u5c0f\u6599\u90fd\u7529\u8d77\u6765\u4e86\uff01",
  strawWarn: "\u26a0\ufe0f \u5438\u7ba1\u8981\u6765\u4e86\uff0c\u5feb\u8eb2\u5f00\u7ea2\u5708\uff01",
  strawActive: "\u{1f964} \u5438\u7ba1\u6b63\u5728\u5438\uff01\u522b\u9760\u592a\u8fd1\uff01",
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
type ActiveEvent = { kind: EventKind; until: number; started: number; x?: number; y?: number; swing?: number; period?: number; stabs?: StrawStab[] };
type EndSequence = { result: "won" | "lost"; started: number; until: number; reason: string; frozenAt?: number };
type Runtime = { running: boolean; startTime: number; lastTime: number; elapsed: number; score: number; highestLevel: number; nextId: number; nextShakeAt: number; lastSpawnAt: number; lastHudAt: number; player: Player; toppings: Topping[]; target: { x: number; y: number; active: boolean }; pointer: { x: number; y: number; smoothX: number; smoothY: number; active: boolean }; joystick: { x: number; y: number; power: number; active: boolean }; keys: Set<string>; event: ActiveEvent; camera: { x: number; y: number }; shakeAngle: number; shakePower: number; endSequence?: EndSequence };
type Hud = { level: number; progress: number; score: number; elapsed: number; message: string };
type ScoreRecord = { name: string; score: number; elapsed: number; highestLevel: number; result: "won" | "lost"; date: string };
type FinalStats = Omit<ScoreRecord, "name" | "date"> & { reason: string };
declare global { interface Window { __MILK_TEA_LEADERBOARD_API__?: string } }

const levelInfo = (level: number) => LEVELS[Math.max(0, Math.min(LEVELS.length - 1, level - 1))];
const radiusForLevel = (level: number) => (level === 1 ? 7.2 : 8.6 * levelInfo(level).scale);
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const rand = (min: number, max: number) => min + Math.random() * (max - min);
const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
function formatTime(ms: number) { const t = Math.max(0, Math.floor(ms / 1000)); return Math.floor(t / 60).toString().padStart(2, "0") + ":" + (t % 60).toString().padStart(2, "0"); }
function loadLocalLeaderboard(): ScoreRecord[] { if (typeof window === "undefined") return []; try { const raw = window.localStorage.getItem(LEADERBOARD_KEY); return raw ? JSON.parse(raw) as ScoreRecord[] : []; } catch { return []; } }
function saveLocalLeaderboard(record: ScoreRecord) { const next = sortLeaderboard([...loadLocalLeaderboard(), record]); window.localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(next)); return next; }
async function loadLeaderboard(): Promise<ScoreRecord[]> { if (typeof window === "undefined") return []; try { const response = await fetch(LEADERBOARD_API, { cache: "no-store" }); if (response.ok) { const data = await response.json() as { records?: ScoreRecord[] }; return sortLeaderboard(data.records ?? []); } } catch {} return loadLocalLeaderboard(); }
async function saveLeaderboard(record: ScoreRecord): Promise<ScoreRecord[]> { if (typeof window !== "undefined") saveLocalLeaderboard(record); try { const response = await fetch(LEADERBOARD_API, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(record) }); if (response.ok) { const data = await response.json() as { records?: ScoreRecord[] }; return sortLeaderboard(data.records ?? []); } } catch {} return loadLocalLeaderboard(); }
function sortLeaderboard(records: ScoreRecord[]) { return records.sort((a, b) => a.result !== b.result ? (a.result === "won" ? -1 : 1) : a.highestLevel !== b.highestLevel ? b.highestLevel - a.highestLevel : a.score !== b.score ? b.score - a.score : b.elapsed - a.elapsed).slice(0, 10); }

const cupT = (y: number) => clamp((y - CUP.topY) / (CUP.bottomY - CUP.topY), 0, 1);
function cupHalfWidthAt(y: number) { const t = cupT(y); return CUP.topW / 2 + (CUP.bottomW / 2 - CUP.topW / 2) * t; }
function cupBoundsAt(y: number, radius = 0) { const half = cupHalfWidthAt(y); return { left: CUP.centerX - half + radius, right: CUP.centerX + half - radius }; }
function isInsideCup(x: number, y: number, radius: number) { if (y < CUP.topY + radius || y > CUP.bottomY - radius) return false; const b = cupBoundsAt(y, radius); return x >= b.left && x <= b.right; }
function clampPointToCup(x: number, y: number, radius: number) { const edgeRadius = Math.max(2, radius * EDGE_TOUCH_RATIO); const cy = clamp(y, CUP.topY + edgeRadius, CUP.bottomY - edgeRadius); const b = cupBoundsAt(cy, edgeRadius); return { x: clamp(x, b.left, b.right), y: cy }; }
function randomCupPoint(radius: number) { const y = rand(CUP.topY + radius + 18, CUP.bottomY - radius - 18); const b = cupBoundsAt(y, radius + 14); return { x: rand(b.left, b.right), y }; }
function difficultyStage(elapsed: number, playerLevel: number) { return Math.min(6, Math.max(Math.floor(elapsed / 23000), Math.floor((playerLevel - 1) / 1.55))); }
function chooseSpawnLevel(playerLevel: number, elapsed = 0) {
  const stage = difficultyStage(elapsed, playerLevel), maxLevel = Math.min(9, playerLevel + 2), minLevel = Math.max(1, Math.min(playerLevel - 4, stage - 1));
  const levels = Array.from({ length: maxLevel - minLevel + 1 }, (_, i) => minLevel + i);
  const pressure = clamp((playerLevel - 1) / 9 + elapsed / 180000, 0, 1.35);
  const weights = levels.map((level) => {
    const delta = level - playerLevel;
    if (delta > 0) return 1.45 + pressure * 2.25 + delta * 0.35;
    if (delta === 0) return 0.16 + pressure * 0.12;
    if (delta >= -1) return 0.45 + pressure * 0.22;
    return 0.8 + pressure * 0.55;
  });
  const total = weights.reduce((s, n) => s + n, 0); let roll = Math.random() * total;
  for (let i = 0; i < weights.length; i += 1) { roll -= weights[i]; if (roll <= 0) return levels[i]; }
  return levels[levels.length - 1];
}
function updateCamera(runtime: Runtime, dt: number) { const viewW = WIDTH / VIEW_SCALE, viewH = HEIGHT / VIEW_SCALE, ease = 1 - Math.exp(-dt * 11); runtime.camera.x += (clamp(runtime.player.x - viewW / 2, 0, WORLD_WIDTH - viewW) - runtime.camera.x) * ease; runtime.camera.y += (clamp(runtime.player.y - viewH / 2, 0, WORLD_HEIGHT - viewH) - runtime.camera.y) * ease; }
function createRuntime(): Runtime {
  const now = performance.now();
  const player: Player = { x: CUP.centerX, y: CUP.bottomY - 160, vx: 0, vy: 0, level: 1, progress: 0, radius: radiusForLevel(1), carried: Array(LEVELS.length + 1).fill(0) };
  const runtime: Runtime = { running: true, startTime: now, lastTime: now, elapsed: 0, score: 0, highestLevel: 1, nextId: 1, nextShakeAt: 2400, lastSpawnAt: 0, lastHudAt: 0, player, toppings: [], target: { x: player.x, y: player.y, active: false }, pointer: { x: WIDTH / VIEW_SCALE / 2, y: HEIGHT / VIEW_SCALE / 2, smoothX: WIDTH / VIEW_SCALE / 2, smoothY: HEIGHT / VIEW_SCALE / 2, active: false }, joystick: { x: 0, y: 0, power: 0, active: false }, keys: new Set(), event: { kind: "idle", until: 0, started: now }, camera: { x: 0, y: 0 }, shakeAngle: 0, shakePower: 0 };
  updateCamera(runtime, 1 / 60); addToppings(runtime, 7, 1); addToppings(runtime, 2, 2); return runtime;
}
function isInViewport(runtime: Runtime, point: { x: number; y: number }, margin = 42) {
  const viewW = WIDTH / VIEW_SCALE, viewH = HEIGHT / VIEW_SCALE;
  return point.x >= runtime.camera.x - margin && point.x <= runtime.camera.x + viewW + margin && point.y >= runtime.camera.y - margin && point.y <= runtime.camera.y + viewH + margin;
}
function visibleSameLevelCount(runtime: Runtime, level: number) {
  return runtime.toppings.filter((item) => item.level === level && isInViewport(runtime, item, item.radius + 18)).length;
}
function chooseControlledSpawnLevel(runtime: Runtime) {
  let level = chooseSpawnLevel(runtime.player.level, runtime.elapsed);
  if (level === runtime.player.level && visibleSameLevelCount(runtime, level) >= 2) {
    level = Math.min(LEVELS.length, level + (Math.random() < 0.72 ? 1 : 2));
  }
  return level;
}
function addToppings(runtime: Runtime, count: number, forcedLevel?: number) {
  for (let i = 0; i < count; i += 1) {
    let level = forcedLevel ?? chooseControlledSpawnLevel(runtime);
    if (level === runtime.player.level && visibleSameLevelCount(runtime, level) >= 2) continue;
    const radius = radiusForLevel(level);
    let point = randomCupPoint(radius);
    for (let attempts = 0; attempts < 80; attempts += 1) {
      point = randomCupPoint(radius);
      const awayFromPlayer = dist(point, runtime.player) > runtime.player.radius + radius + 55;
      const hiddenSpawn = runtime.elapsed < 600 ? true : !isInViewport(runtime, point, radius + 64);
      if (awayFromPlayer && hiddenSpawn) break;
      if (attempts === 79 && !hiddenSpawn && forcedLevel == null) level = Math.min(LEVELS.length, Math.max(runtime.player.level + 1, level));
    }
    runtime.toppings.push({ id: runtime.nextId, x: point.x, y: point.y, vx: rand(-68, 68), vy: rand(-68, 68), level, radius: radiusForLevel(level), spin: rand(0, Math.PI * 2) });
    runtime.nextId += 1;
  }
}
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
  player.progress = Math.min(2, player.carried[player.level] ?? 0);
}
function eventMessage(event: ActiveEvent) { if (event.kind === "shakeWarning") return TXT.shakeWarn; if (event.kind === "shaking") return TXT.shaking; if (event.kind === "strawWarning") return TXT.strawWarn; if (event.kind === "strawActive") return TXT.strawActive; return TXT.defaultHint; }
function triggerShake(runtime: Runtime, now: number) { runtime.event = { kind: "shakeWarning", until: now + 800, started: now, swing: Math.random() > 0.5 ? 1 : -1 }; }
function strawDifficulty(runtime: Runtime) { return clamp(runtime.elapsed / 104000 + Math.max(0, runtime.player.level - 1) / 14, 0, 1.9); }
function strawPeriod(runtime: Runtime) { const stage = difficultyStage(runtime.elapsed, runtime.player.level); return Math.max(420, 720 - strawDifficulty(runtime) * 120 - stage * 18); }
function buildStrawStabs(runtime: Runtime): StrawStab[] {
  const d = strawDifficulty(runtime), spread = 0.65 + d * 0.078, y0 = CUP.topY + 360, y1 = CUP.topY + 610, y2 = CUP.topY + 860;
  const points = [
    { x: CUP.centerX - cupHalfWidthAt(y0) * spread, y: y0 },
    { x: CUP.centerX, y: y1 },
    { x: CUP.centerX + cupHalfWidthAt(y2) * spread, y: y2 },
  ];
  return points.map((point, index) => ({ x: point.x, y: point.y, fromX: point.x - 118 + index * 18, fromY: CUP.topY - 180 - index * 28 }));
}
function triggerStraw(runtime: Runtime, now: number) { const stabs = buildStrawStabs(runtime); runtime.event = { kind: "strawWarning", until: now + Math.max(760, 1040 - strawDifficulty(runtime) * 120), started: now, stabs }; }
function strawPhase(runtime: Runtime, now: number) { const period = runtime.event.period ?? strawPeriod(runtime); const elapsed = Math.max(0, now - runtime.event.started); return { period, strike: Math.floor(elapsed / period), phase: (elapsed % period) / period }; }
function currentStrawStab(runtime: Runtime, now: number) {
  const phaseInfo = strawPhase(runtime, now), stabs = runtime.event.stabs ?? buildStrawStabs(runtime), strike = Math.min(stabs.length - 1, phaseInfo.strike), stab = stabs[strike];
  const thrust = phaseInfo.phase < 0.42 ? phaseInfo.phase / 0.42 : phaseInfo.phase < 0.68 ? 1 : 1 - (phaseInfo.phase - 0.68) / 0.32;
  const eased = clamp(thrust, 0, 1), x = stab.fromX + (stab.x - stab.fromX) * eased, y = stab.fromY + (stab.y - stab.fromY) * eased;
  return { x, y, target: { x: stab.x, y: stab.y }, fromX: stab.fromX, fromY: stab.fromY, active: phaseInfo.phase > 0.18 && phaseInfo.phase < 0.82 && phaseInfo.strike < stabs.length, strike, phase: phaseInfo.phase };
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
function drawStrawDangerRect(ctx: CanvasRenderingContext2D, stab: StrawStab, active: boolean, alpha: number) {
  const dx = stab.x - stab.fromX, dy = stab.y - stab.fromY, length = Math.hypot(dx, dy) + 110, width = active ? 104 : 92;
  ctx.save();
  ctx.translate((stab.fromX + stab.x) / 2, (stab.fromY + stab.y) / 2);
  ctx.rotate(Math.atan2(dy, dx) - Math.PI / 2);
  ctx.fillStyle = active ? "rgba(255,52,88," + (0.18 * alpha) + ")" : "rgba(255,52,88," + (0.16 * alpha) + ")";
  ctx.strokeStyle = active ? "rgba(255,255,255," + (0.68 * alpha) + ")" : "rgba(255,52,88," + (0.9 * alpha) + ")";
  ctx.lineWidth = active ? 6 : 5;
  ctx.setLineDash(active ? [22, 12] : [14, 9]);
  ctx.beginPath();
  ctx.roundRect(-width / 2, -length / 2, width, length, 18);
  ctx.fill();
  ctx.stroke();
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = active ? "rgba(255,64,88,0.94)" : "rgba(255,64,88,0.84)";
  ctx.fillStyle = active ? "rgba(255,86,104,0.16)" : "rgba(255,222,86,0.2)";
  ctx.lineWidth = active ? 6 : 5;
  ctx.setLineDash(active ? [] : [10, 8]);
  ctx.beginPath();
  ctx.arc(stab.x, stab.y, active ? 64 : 76, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}
function drawStrawOverlay(ctx: CanvasRenderingContext2D, runtime: Runtime, assets: AssetImageMap) {
  if (runtime.event.kind !== "strawActive") return;
  const tip = currentStrawStab(runtime, runtime.endSequence?.frozenAt ?? performance.now());
  const strawImage = assetImage(assets, "scene-straw");
  if (strawImage) drawAssetBetween(ctx, strawImage, { x: tip.fromX, y: tip.fromY }, tip, 100, 190);
  else {
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineWidth = 30;
    ctx.strokeStyle = "#ff7b93";
    ctx.beginPath();
    ctx.moveTo(tip.fromX, tip.fromY);
    ctx.lineTo(tip.x, tip.y);
    ctx.stroke();
    ctx.lineWidth = 10;
    ctx.strokeStyle = "rgba(255,255,255,0.92)";
    ctx.setLineDash([24, 22]);
    ctx.beginPath();
    ctx.moveTo(tip.fromX, tip.fromY);
    ctx.lineTo(tip.x, tip.y);
    ctx.stroke();
    ctx.restore();
  }
}
function drawIngredient(ctx: CanvasRenderingContext2D, item: { x: number; y: number; radius: number; level: number }, isPlayer = false, assets: AssetImageMap = {}) {
  const lv = levelInfo(item.level); ctx.save(); ctx.translate(item.x, item.y);
  const image = assetImage(assets, lv.assetId);
  if (image) {
    const size = item.radius * 2.9;
    if (isPlayer) ctx.filter = "drop-shadow(0 0 2px rgba(255,210,84,1)) drop-shadow(0 0 4px rgba(255,184,42,0.95))";
    ctx.drawImage(image, -size / 2, -size / 2, size, size);
    ctx.filter = "none";
  } else {
    const points = Math.max(5, Math.min(8, item.level + 4));
    ctx.fillStyle = lv.color; ctx.beginPath();
    for (let i = 0; i < points; i += 1) { const angle = -Math.PI / 2 + i / points * Math.PI * 2, r = item.radius * (i % 2 ? 0.82 : 1); const x = Math.cos(angle) * r, y = Math.sin(angle) * r; if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
    ctx.closePath(); ctx.fill(); ctx.strokeStyle = "rgba(255,255,255,0.72)"; ctx.lineWidth = Math.max(1.5, item.radius * 0.12); ctx.stroke();
  }
  if (isPlayer && !image) { ctx.strokeStyle = "rgba(255, 210, 84, 0.96)"; ctx.lineWidth = Math.max(3, item.radius * 0.16); ctx.lineJoin = "round"; ctx.stroke(); }
  ctx.restore();
}
function drawPlayerWithCarried(ctx: CanvasRenderingContext2D, runtime: Runtime, assets: AssetImageMap) {
  const player = runtime.player;
  const pieces: number[] = [];
  for (let level = LEVELS.length; level >= 1; level -= 1) { const count = player.carried[level] ?? 0; for (let i = 0; i < count; i += 1) pieces.push(level); }
  const time = runtime.elapsed / 1000;
  pieces.slice(0, 36).forEach((level, index) => {
    if (level <= 0) return;
    const ring = Math.floor(index / 10), slot = index % 10;
    const angle = slot / 10 * Math.PI * 2 + ring * 0.5 + time * (0.88 + ring * 0.16);
    const orbit = player.radius + 15 + ring * 12 + Math.sin(time * 4.2 + index) * 2.4;
    const pieceRadius = clamp(radiusForLevel(level) * 0.54, 5.8, Math.max(8.2, player.radius * 0.58));
    drawIngredient(ctx, { x: player.x + Math.cos(angle) * orbit, y: player.y + Math.sin(angle) * orbit, level, radius: pieceRadius }, false, assets);
  });
  drawIngredient(ctx, player, true, assets);
}
function drawWorldBackground(ctx: CanvasRenderingContext2D, runtime: Runtime | null) {
  const bg = ctx.createLinearGradient(0, 0, 0, WORLD_HEIGHT);
  bg.addColorStop(0, "#fffaf0");
  bg.addColorStop(0.52, "#fff2dd");
  bg.addColorStop(1, "#f5d7b9");
  ctx.fillStyle = bg;
  ctx.fillRect(-200, -200, WORLD_WIDTH + 400, WORLD_HEIGHT + 400);
  ctx.strokeStyle = "rgba(203, 149, 104, 0.18)";
  ctx.lineWidth = 1.2;
  for (let x = -200; x <= WORLD_WIDTH + 220; x += 34) { ctx.beginPath(); ctx.moveTo(x, -200); ctx.lineTo(x, WORLD_HEIGHT + 220); ctx.stroke(); }
  for (let y = -200; y <= WORLD_HEIGHT + 220; y += 34) { ctx.beginPath(); ctx.moveTo(-200, y); ctx.lineTo(WORLD_WIDTH + 220, y); ctx.stroke(); }
  ctx.strokeStyle = "rgba(145, 102, 69, 0.16)";
  ctx.lineWidth = 4;
  ctx.setLineDash([16, 14]);
  ctx.strokeRect(16, 18, WORLD_WIDTH - 32, WORLD_HEIGHT - 36);
  ctx.setLineDash([]);
  const shift = runtime ? runtime.elapsed / 240 : 0;
  ctx.strokeStyle = "rgba(224, 151, 128, 0.24)";
  ctx.lineWidth = 3;
  for (let line = 0; line < 7; line += 1) { ctx.beginPath(); const y = 142 + line * 150; for (let x = 26; x <= WORLD_WIDTH - 26; x += 22) { const wy = y + Math.sin((x + shift + line * 39) / 38) * 5; if (x === 26) ctx.moveTo(x, wy); else ctx.lineTo(x, wy); } ctx.stroke(); }
  ctx.fillStyle = "rgba(255, 199, 122, 0.34)";
  for (let i = 0; i < 30; i += 1) { ctx.beginPath(); ctx.arc((i * 97) % WORLD_WIDTH, 66 + ((i * 151) % WORLD_HEIGHT), 1.4 + (i % 3), 0, Math.PI * 2); ctx.fill(); }
}
function drawScene(ctx: CanvasRenderingContext2D, runtime: Runtime | null, status: Status, assets: AssetImageMap = {}) {
  ctx.clearRect(0, 0, WIDTH, HEIGHT); const screenBg = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT); screenBg.addColorStop(0, "#fffaf0"); screenBg.addColorStop(1, "#f7d7bd"); ctx.fillStyle = screenBg; ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.save(); if (runtime) { ctx.scale(VIEW_SCALE, VIEW_SCALE); ctx.translate(-runtime.camera.x, -runtime.camera.y); } else { ctx.translate((WIDTH - WORLD_WIDTH * 0.42) / 2, 35); ctx.scale(0.42, 0.42); }
  ctx.save(); if (runtime) { const cupSwingX = Math.sin(runtime.elapsed / 20) * runtime.shakePower * 70; ctx.translate(CUP_CENTER.x + cupSwingX, CUP_CENTER.y); ctx.rotate(runtime.shakeAngle); ctx.translate(-CUP_CENTER.x, -CUP_CENTER.y); }
  drawWorldBackground(ctx, runtime); drawCupPath(ctx, 12); ctx.fillStyle = "rgba(255,255,255,0.26)"; ctx.fill(); ctx.strokeStyle = "rgba(255,255,255,0.82)"; ctx.lineWidth = 7; ctx.stroke();
  const cupImage = assetImage(assets, "scene-milk-tea-cup");
  if (cupImage) drawAssetCentered(ctx, cupImage, CUP.centerX, CUP_CENTER.y, CUP.topW + 90, CUP.bottomY - CUP.topY + 118, 0.5);
  drawCupPath(ctx); const tea = ctx.createLinearGradient(0, CUP.topY, 0, CUP.bottomY); tea.addColorStop(0, "rgba(245,211,158,0.54)"); tea.addColorStop(0.48, "rgba(226,172,116,0.6)"); tea.addColorStop(1, "rgba(194,132,82,0.64)"); ctx.fillStyle = tea; ctx.fill();
  const teaSurface = assetImage(assets, "scene-tea-surface");
  if (teaSurface) {
    ctx.save();
    drawCupPath(ctx); ctx.clip();
    const pattern = ctx.createPattern(teaSurface, "repeat");
    if (pattern) {
      ctx.globalAlpha = 0.34;
      ctx.translate(runtime ? runtime.elapsed / -90 : 0, runtime ? runtime.elapsed / 150 : 0);
      ctx.fillStyle = pattern;
      ctx.fillRect(-280, CUP.topY - 80, WORLD_WIDTH + 560, CUP.bottomY - CUP.topY + 180);
    }
    ctx.restore();
  }
  ctx.save(); drawCupPath(ctx); ctx.clip();
  if (runtime) {
    if (runtime.event.kind === "shakeWarning" || runtime.event.kind === "shaking") {
      const waveImage = null;
      if (waveImage) {
        const alpha = runtime.event.kind === "shaking" ? 0.58 : 0.42;
        for (let i = 0; i < 5; i += 1) drawAssetCentered(ctx, waveImage, CUP.centerX + Math.sin(runtime.elapsed / 120 + i) * 36, CUP.topY + 150 + i * 180, 430, 122, alpha);
      } else {
        ctx.strokeStyle = runtime.event.kind === "shaking" ? "rgba(255,255,255,0.52)" : "rgba(255,224,86,0.7)"; ctx.lineWidth = 8; for (let i = 0; i < 6; i += 1) { ctx.beginPath(); const y = CUP.topY + 120 + i * 160; ctx.moveTo(CUP.centerX - 190, y); ctx.bezierCurveTo(CUP.centerX - 80, y - 80, CUP.centerX + 80, y + 80, CUP.centerX + 190, y); ctx.stroke(); }
      }
    }
    if (runtime.event.kind === "strawWarning" || runtime.event.kind === "strawActive") {
      const renderNow = runtime.endSequence?.frozenAt ?? performance.now(); const activeStab = runtime.event.kind === "strawActive" ? currentStrawStab(runtime, renderNow) : null; const stabs = runtime.event.stabs ?? buildStrawStabs(runtime); const marks = activeStab ? [stabs[activeStab.strike] ?? stabs[0]] : stabs;
      marks.forEach((mark, index) => {
        const alpha = runtime.event.kind === "strawActive" && activeStab?.strike !== index ? 0.34 : runtime.event.kind === "strawActive" ? 0.82 : 0.72;
        drawStrawDangerRect(ctx, mark, runtime.event.kind === "strawActive", alpha);
      });
      if (runtime.event.kind === "strawActive" && activeStab) { for (let ring = 0; ring < 3; ring += 1) { ctx.strokeStyle = "rgba(255,255,255," + (0.42 - ring * 0.08) + ")"; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(activeStab.x, activeStab.y, 30 + ring * 24 + Math.sin(runtime.elapsed / 70 + ring) * 5, 0.2 + ring, Math.PI * 1.66 + ring); ctx.stroke(); } ctx.fillStyle = "rgba(255,255,255,0.86)"; ctx.font = "700 22px sans-serif"; ctx.textAlign = "center"; ctx.fillText(String(activeStab.strike + 1) + "/3", activeStab.target.x, activeStab.target.y - 78); }
    }
    runtime.toppings.slice().sort((a, b) => a.level - b.level).forEach((item) => drawIngredient(ctx, item, false, assets)); drawPlayerWithCarried(ctx, runtime, assets);
    if (runtime.endSequence) { const duration = runtime.endSequence.result === "won" ? 3000 : 1000, t = clamp((performance.now() - runtime.endSequence.started) / duration, 0, 1), pulse = 0.5 + Math.sin(t * Math.PI * (runtime.endSequence.result === "won" ? 8 : 5)) * 0.5, won = runtime.endSequence.result === "won"; ctx.save(); ctx.textAlign = "center"; ctx.font = won ? "800 34px sans-serif" : "800 30px sans-serif"; ctx.fillStyle = won ? "rgba(255,245,206,0.96)" : "rgba(255,236,232,0.96)"; ctx.strokeStyle = won ? "rgba(121,63,21,0.72)" : "rgba(105,29,33,0.78)"; ctx.lineWidth = 5; const label = won ? "\u5927\u67ff\u5b50\u5b8c\u6210\uff01" : "\u7cdf\u7cd5\uff0c\u88ab\u51fb\u4e2d\u4e86"; ctx.strokeText(label, runtime.player.x, runtime.player.y - runtime.player.radius - 42); ctx.fillText(label, runtime.player.x, runtime.player.y - runtime.player.radius - 42); for (let i = 0; i < 5; i += 1) { ctx.strokeStyle = won ? "rgba(255,218,84," + (0.7 - i * 0.11) + ")" : "rgba(255,84,96," + (0.68 - i * 0.1) + ")"; ctx.lineWidth = won ? 3 : 4; ctx.beginPath(); ctx.arc(runtime.player.x, runtime.player.y, runtime.player.radius + 18 + i * (won ? 18 : 14) + pulse * (won ? 10 : 16), 0, Math.PI * 2); ctx.stroke(); } ctx.restore(); }
  } else { const titleImage = assetImage(assets, "ui-title-badge"); if (titleImage) drawAssetCentered(ctx, titleImage, CUP.centerX, CUP_CENTER.y + 20, 210, 210, 0.9); else { ctx.font = "132px sans-serif"; ctx.textAlign = "center"; ctx.fillText("\u{1f9cb}", CUP.centerX, CUP_CENTER.y + 40); } }
  ctx.restore(); ctx.restore(); if (runtime) drawStrawOverlay(ctx, runtime, assets); ctx.restore(); ctx.fillStyle = "rgba(171,115,72,0.08)"; ctx.fillRect(0, HEIGHT - 28, WIDTH, 28); if (status !== "playing") { ctx.fillStyle = "rgba(255,250,240,0.18)"; ctx.fillRect(0, 0, WIDTH, HEIGHT); }
}
function updateRuntime(runtime: Runtime, dt: number, now: number, finish: (result: "won" | "lost", reason: string) => void) {
  runtime.elapsed = now - runtime.startTime; const player = runtime.player; const difficulty = Math.min(runtime.elapsed / 150000, 1), stage = difficultyStage(runtime.elapsed, player.level);
  if (runtime.endSequence) { const won = runtime.endSequence.result === "won"; player.vx = 0; player.vy = 0; runtime.target.active = false; runtime.pointer.active = false; runtime.joystick = { x: 0, y: 0, power: 0, active: false }; runtime.shakeAngle = won ? Math.sin((now - runtime.endSequence.started) / 120) * 0.035 * (1 - clamp((now - runtime.endSequence.started) / Math.max(1, runtime.endSequence.until - runtime.endSequence.started), 0, 1)) : runtime.shakeAngle; runtime.shakePower = won ? 0.25 : runtime.shakePower; updateCamera(runtime, dt); if (now >= runtime.endSequence.until) finish(runtime.endSequence.result, runtime.endSequence.reason); return; }
  if (runtime.event.kind === "idle") { if (runtime.elapsed >= runtime.nextShakeAt) triggerShake(runtime, now); else if (runtime.elapsed >= 3450 && Math.random() < dt * (0.312 + difficulty * 1.118 + stage * 0.144)) triggerStraw(runtime, now); }
  else if (runtime.event.kind === "shakeWarning" && now >= runtime.event.until) { runtime.event = { ...runtime.event, kind: "shaking", until: now + 2405 + difficulty * 845 + stage * 156, started: now }; runtime.shakePower = 1; }
  else if (runtime.event.kind === "shaking" && now >= runtime.event.until) { runtime.score += 100; runtime.event = { kind: "idle", until: 0, started: now }; runtime.nextShakeAt = runtime.elapsed + rand(Math.max(1600, (11000 - difficulty * 4600 - stage * 360) / 3.38), Math.max(2385, (19000 - difficulty * 6500 - stage * 520) / 3.38)); }
  else if (runtime.event.kind === "strawWarning" && now >= runtime.event.until) { const period = strawPeriod(runtime); runtime.event = { ...runtime.event, kind: "strawActive", until: now + period * 3, started: now, period }; }
  else if (runtime.event.kind === "strawActive" && now >= runtime.event.until) { runtime.score += 200; runtime.event = { kind: "idle", until: 0, started: now }; }
  const keyX = (runtime.keys.has("arrowright") || runtime.keys.has("d") ? 1 : 0) - (runtime.keys.has("arrowleft") || runtime.keys.has("a") ? 1 : 0); const keyY = (runtime.keys.has("arrowdown") || runtime.keys.has("s") ? 1 : 0) - (runtime.keys.has("arrowup") || runtime.keys.has("w") ? 1 : 0); let dirX = keyX, dirY = keyY, inputPower = (keyX || keyY) ? 1 : 0;
  if (runtime.joystick.active && inputPower === 0) { dirX = runtime.joystick.x; dirY = runtime.joystick.y; inputPower = runtime.joystick.power; }
  const speedPenalty = (levelInfo(player.level).scale - 1) * 10, maxSpeed = 144 - speedPenalty;
  let targetVx = 0, targetVy = 0, velocityEase = 1;
  if (dirX === 0 && dirY === 0 && runtime.pointer.active) {
    const pointerEase = 1 - Math.exp(-dt * 18);
    runtime.pointer.smoothX += (runtime.pointer.x - runtime.pointer.smoothX) * pointerEase;
    runtime.pointer.smoothY += (runtime.pointer.y - runtime.pointer.smoothY) * pointerEase;
    const screenX = player.x - runtime.camera.x, screenY = player.y - runtime.camera.y, dx = runtime.pointer.smoothX - screenX, dy = runtime.pointer.smoothY - screenY, len = Math.hypot(dx, dy);
    if (len > 0.65) { const follow = 5.8, speed = Math.min(maxSpeed, len * follow); targetVx = dx / len * speed; targetVy = dy / len * speed; }
    velocityEase = 1 - Math.exp(-dt * 16);
  } else {
    if (dirX || dirY) { const len = Math.hypot(dirX, dirY); dirX /= len; dirY /= len; }
    targetVx = dirX * maxSpeed * inputPower; targetVy = dirY * maxSpeed * inputPower;
  }
  const controlVx = runtime.event.kind === "shaking" ? targetVx * 0.23 : targetVx, controlVy = runtime.event.kind === "shaking" ? targetVy * 0.23 : targetVy;
  player.vx += (controlVx - player.vx) * velocityEase; player.vy += (controlVy - player.vy) * velocityEase;
  if (runtime.event.kind === "shaking") { const elapsed = now - runtime.event.started, direction = runtime.event.swing ?? 1, pulse = Math.sin(elapsed / 21), swing = direction * pulse; runtime.shakeAngle = swing * (0.82 + difficulty * 0.18); runtime.shakePower = Math.max(0, 1 - elapsed / Math.max(2100, runtime.event.until - runtime.event.started)); const shakeStrength = 2250 + difficulty * 1680 + stage * 240, lateral = Math.cos(elapsed / 21) * direction; for (const item of [player, ...runtime.toppings]) { const dx = item.x - CUP_CENTER.x, dy = item.y - CUP_CENTER.y, len = Math.max(80, Math.hypot(dx, dy)); const tangentX = -dy / len, tangentY = dx / len, bottomBias = 0.65 + cupT(item.y) * 0.9, shakeWeight = item === player ? 0.7 : 1; item.vx += (tangentX * shakeStrength * swing + lateral * shakeStrength * 0.95) * bottomBias * dt * shakeWeight; item.vy += (tangentY * shakeStrength * swing + Math.sin(elapsed / 15.5) * (494 + stage * 58)) * bottomBias * dt * shakeWeight; } } else { runtime.shakeAngle *= 0.82; runtime.shakePower *= 0.84; }
  if (runtime.event.kind === "strawActive") { const tip = currentStrawStab(runtime, now), c = tip.target, dangerRadius = 56 + difficulty * 29 + stage * 7, pullRadius = 286 + difficulty * 99 + stage * 23, pull = 390 + difficulty * 319 + stage * 81, dPlayer = dist(player, tip); if (tip.active && dPlayer < dangerRadius + player.radius * 0.55) { runtime.endSequence = { result: "lost", started: now, until: now + 1000, reason: "\u4f60\u88ab\u5438\u7ba1\u6233\u5230\u4e86", frozenAt: now }; return; } runtime.toppings = runtime.toppings.filter((item) => { const d = dist(item, tip); if (tip.active && d < dangerRadius + item.radius * 0.3) return false; if (d < pullRadius) { const power = (1 - d / pullRadius) * pull * 0.95; item.vx += (c.x - item.x) / Math.max(1, d) * power * dt; item.vy += (c.y - item.y) / Math.max(1, d) * power * dt; } return true; }); }
  player.x += player.vx * dt; player.y += player.vy * dt; keepInCup(player);
  for (const item of runtime.toppings) { const wander = 21 + item.level * 3.1; item.vx += Math.cos(now / 620 + item.spin) * wander * dt; item.vy += Math.sin(now / 760 + item.spin) * wander * dt; const maxItemSpeed = runtime.event.kind === "shaking" ? 468 + difficulty * 156 : 75 + item.level * 6.5 + difficulty * 31, speed = Math.hypot(item.vx, item.vy); if (speed > maxItemSpeed) { item.vx = item.vx / speed * maxItemSpeed; item.vy = item.vy / speed * maxItemSpeed; } item.x += item.vx * dt; item.y += item.vy * dt; keepInCup(item); }
  for (let i = runtime.toppings.length - 1; i >= 0; i -= 1) { const item = runtime.toppings[i]; if (!isInsideCup(item.x, item.y, item.radius)) continue; if (dist(player, item) < player.radius + item.radius * 0.72) { if (item.level > player.level) { runtime.endSequence = { result: "lost", started: now, until: now + 1000, reason: "\u649e\u4e0a\u4e86\u66f4\u5927\u7684" + levelInfo(item.level).name, frozenAt: now }; runtime.event = { kind: "idle", until: 0, started: now }; return; } runtime.toppings.splice(i, 1); const oldLevel = player.level; player.carried[item.level] = (player.carried[item.level] ?? 0) + 1; runtime.score += item.level === oldLevel ? item.level * 20 : item.level * 10; normalizePlayerInventory(player); if (player.level > oldLevel) { for (let level = oldLevel + 1; level <= player.level; level += 1) runtime.score += level * 100; runtime.highestLevel = Math.max(runtime.highestLevel, player.level); player.vx *= 0.45; player.vy *= 0.45; if (player.level >= 10) { runtime.score += 3000; runtime.endSequence = { result: "won", started: now, until: now + 3000, reason: "\u4f60\u5408\u6210\u4e86\u4f20\u8bf4\u4e2d\u7684\u67ff\u5b50" }; runtime.event = { kind: "idle", until: 0, started: now }; runtime.toppings = []; return; } } } }
  if (runtime.elapsed - runtime.lastSpawnAt > Math.max(650, 2077 - stage * 310)) { runtime.lastSpawnAt = runtime.elapsed; const desired = 12 + stage * 9 + Math.round(difficulty * 16) + runtime.player.level * 4; if (runtime.toppings.length < desired) addToppings(runtime, Math.min(3 + stage * 3, desired - runtime.toppings.length)); }
  updateCamera(runtime, dt);
}

export function MilkTeaGame() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null); const runtimeRef = useRef<Runtime | null>(null); const assetImagesRef = useRef<AssetImageMap>({}); const joystickKnobRef = useRef<HTMLSpanElement | null>(null); const [assetRevision, setAssetRevision] = useState(0); const [status, setStatus] = useState<Status>("menu"); const [hud, setHud] = useState<Hud>({ level: 1, progress: 0, score: 0, elapsed: 0, message: TXT.defaultHint }); const [finalStats, setFinalStats] = useState<FinalStats | null>(null); const [leaderboard, setLeaderboard] = useState<ScoreRecord[]>([]); const [playerName, setPlayerName] = useState(TXT.defaultName); const [saved, setSaved] = useState(false);
  const updateTargetFromClient = (clientX: number, clientY: number) => { const canvas = canvasRef.current, runtime = runtimeRef.current; if (!canvas || !runtime || !runtime.running) return; const rect = canvas.getBoundingClientRect(); const x = ((clientX - rect.left) / rect.width) * WIDTH / VIEW_SCALE, y = ((clientY - rect.top) / rect.height) * HEIGHT / VIEW_SCALE; runtime.pointer = runtime.pointer.active ? { ...runtime.pointer, x, y, active: true } : { x, y, smoothX: x, smoothY: y, active: true }; runtime.target.active = false; };
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
  useEffect(() => { void loadLeaderboard().then(setLeaderboard); }, []);
  useEffect(() => { const down = (e: KeyboardEvent) => { const k = e.key.toLowerCase(); if (["arrowup", "arrowdown", "arrowleft", "arrowright", "w", "a", "s", "d"].includes(k)) { e.preventDefault(); runtimeRef.current?.keys.add(k); } }; const up = (e: KeyboardEvent) => runtimeRef.current?.keys.delete(e.key.toLowerCase()); window.addEventListener("keydown", down); window.addEventListener("keyup", up); return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); }; }, []);
  useEffect(() => { if (status !== "playing") return; const movePointer = (event: PointerEvent) => { if (event.pointerType !== "touch") updateTargetFromClient(event.clientX, event.clientY); }; window.addEventListener("pointermove", movePointer); return () => { window.removeEventListener("pointermove", movePointer); }; }, [status]);
  useEffect(() => { const canvas = canvasRef.current, ctx = canvas?.getContext("2d"); if (!ctx || !canvas) return; let frame = 0; const finish = (result: "won" | "lost", reason: string) => { const runtime = runtimeRef.current; if (!runtime || !runtime.running) return; runtime.running = false; setFinalStats({ result, reason, score: runtime.score, elapsed: runtime.elapsed, highestLevel: runtime.highestLevel }); setSaved(false); setStatus(result); }; const loop = (now: number) => { const runtime = runtimeRef.current; if (!runtime || !runtime.running) return; const dt = Math.min(0.033, Math.max(0.001, (now - runtime.lastTime) / 1000)); runtime.lastTime = now; updateRuntime(runtime, dt, now, finish); drawScene(ctx, runtime, "playing", assetImagesRef.current); if (now - runtime.lastHudAt > 100) { runtime.lastHudAt = now; setHud({ level: runtime.player.level, progress: runtime.player.progress, score: runtime.score, elapsed: runtime.elapsed, message: eventMessage(runtime.event) }); } frame = window.requestAnimationFrame(loop); }; if (status === "playing") frame = window.requestAnimationFrame(loop); else drawScene(ctx, runtimeRef.current, status, assetImagesRef.current); return () => window.cancelAnimationFrame(frame); }, [status, assetRevision]);
  const startGame = () => { const runtime = createRuntime(); runtimeRef.current = runtime; setFinalStats(null); setSaved(false); setHud({ level: 1, progress: 0, score: 0, elapsed: 0, message: TXT.defaultHint }); setStatus("playing"); };
  const openLeaderboard = () => { setStatus("leaderboard"); void loadLeaderboard().then(setLeaderboard); };
  const handlePointer = (event: React.PointerEvent<HTMLCanvasElement>) => { if (event.pointerType === "touch") return; if (event.type === "pointerdown") event.currentTarget.setPointerCapture(event.pointerId); updateTargetFromClient(event.clientX, event.clientY); };
  const stopPointer = () => { if (runtimeRef.current) { runtimeRef.current.player.vx = 0; runtimeRef.current.player.vy = 0; } };
  const persistScore = () => { if (!finalStats || saved) return; const record = { name: (playerName.trim() || TXT.defaultName).slice(0, 12), score: finalStats.score, elapsed: finalStats.elapsed, highestLevel: finalStats.highestLevel, result: finalStats.result, date: new Date().toLocaleString("zh-CN") }; setSaved(true); void saveLeaderboard(record).then(setLeaderboard).catch(() => setSaved(false)); };
  const current = levelInfo(hud.level), next = hud.level < 10 ? levelInfo(hud.level + 1) : null, finalLevelName = finalStats ? levelInfo(finalStats.highestLevel).name : current.name;
  const joystickRef = useRef<HTMLDivElement | null>(null);
  const [joystickActive, setJoystickActive] = useState(false);
  const updateJoystick = (event: React.PointerEvent<HTMLDivElement>) => { const runtime = runtimeRef.current, node = joystickRef.current; if (!runtime || !node || !runtime.running) return; const rect = node.getBoundingClientRect(); const centerX = rect.left + rect.width / 2, centerY = rect.top + rect.height / 2, limit = rect.width * 0.36; const rawX = event.clientX - centerX, rawY = event.clientY - centerY, length = Math.hypot(rawX, rawY), power = clamp(length / limit, 0, 1); const unitX = length > 0 ? rawX / length : 0, unitY = length > 0 ? rawY / length : 0, knobX = unitX * power * 28, knobY = unitY * power * 28; runtime.joystick = { x: unitX, y: unitY, power, active: true }; runtime.target.active = false; runtime.pointer.active = false; if (joystickKnobRef.current) joystickKnobRef.current.style.transform = `translate(${knobX}px, ${knobY}px)`; };
  const startJoystick = (event: React.PointerEvent<HTMLDivElement>) => { event.currentTarget.setPointerCapture(event.pointerId); setJoystickActive(true); updateJoystick(event); };
  const stopJoystick = () => { if (runtimeRef.current) { runtimeRef.current.joystick = { x: 0, y: 0, power: 0, active: false }; runtimeRef.current.player.vx = 0; runtimeRef.current.player.vy = 0; } if (joystickKnobRef.current) joystickKnobRef.current.style.transform = "translate(0px, 0px)"; setJoystickActive(false); };
  const menuBadgeUrl = assetUrl("ui-title-badge");
  const victoryBurstUrl = assetUrl("ui-victory-burst");
  const strawUrl = assetUrl("scene-straw");
  const currentAssetUrl = assetUrl(current.assetId);
  const nextAssetUrl = next ? assetUrl(next.assetId) : null;
  const imageButton = (label: string, image: string, onClick: () => void, className = "", disabled = false) => (
    <button className={"image-button " + className} onClick={onClick} disabled={disabled}>
      <img src={image} alt="" aria-hidden="true" />
      <span>{label}</span>
    </button>
  );
  return (
    <main className="game-shell" aria-label="\u8fd9\u676f\u6709\u70b9\u592a\u523a\u6fc0\u4e86\u6e38\u620f">
      <section className="phone-frame" aria-label="game area"><div className="hud top-hud"><div><small>{"\u5f53\u524d"}</small><strong>{currentAssetUrl ? <img className="hud-icon" src={currentAssetUrl} alt="" /> : current.emoji} {current.name}</strong></div><div><small>{"\u8fdb\u5ea6"}</small><strong>{hud.progress}/2</strong></div><div><small>{"\u65f6\u95f4"}</small><strong>{formatTime(hud.elapsed)}</strong></div></div><canvas ref={canvasRef} width={WIDTH} height={HEIGHT} className="game-canvas" onPointerDown={handlePointer} onPointerMove={handlePointer} onPointerUp={stopPointer} onPointerCancel={stopPointer} aria-label="game canvas" /><div className="hud bottom-hud"><span>{hud.message}</span><b>{hud.score} {"\u5206"}</b></div>
        {status === "playing" && <div ref={joystickRef} className={"joystick" + (joystickActive ? " active" : "")} onPointerDown={startJoystick} onPointerMove={updateJoystick} onPointerUp={stopJoystick} onPointerCancel={stopJoystick} aria-label="virtual joystick"><span ref={joystickKnobRef} /></div>}
        {status === "menu" && <div className="overlay menu-overlay"><div className="logo-bubble">{menuBadgeUrl ? <img src={menuBadgeUrl} alt="" /> : "\u25cb"}</div>{imageButton("\u5f00\u59cb\u6e38\u620f", "/generated-assets/ui-start-button.png", startGame)}{imageButton("\u6392\u884c\u699c", "/generated-assets/ui-leaderboard-button.png", openLeaderboard, "secondary")}</div>}
        {(status === "won" || status === "lost") && finalStats && <div className={"overlay result-overlay " + (status === "won" ? "win" : "lose")}><div className="logo-bubble">{status === "won" ? <img src="/generated-assets/ui-success-reward.png" alt="" /> : <img src="/generated-assets/ui-fail-burst.png" alt="" />}</div><p className="reason">{finalStats.reason}</p><div className="stat-grid"><span>{"\u575a\u6301\u65f6\u95f4"} <b>{formatTime(finalStats.elapsed)}</b></span><span>{"\u6700\u9ad8\u7b49\u7ea7"} <b>{finalLevelName}</b></span><span>{"\u6700\u7ec8\u5206\u6570"} <b>{finalStats.score}</b></span></div><label className="name-input">{"\u6392\u884c\u699c\u6635\u79f0"}<input value={playerName} maxLength={12} onChange={(e) => setPlayerName(e.target.value)} /></label><div className="button-row">{imageButton(saved ? "\u5df2\u4fdd\u5b58" : "\u4fdd\u5b58\u6210\u7ee9", "/generated-assets/ui-cream-button.png", persistScore, "cream", saved)}{imageButton("\u518d\u6765\u4e00\u5c40", "/generated-assets/ui-start-button.png", startGame)}</div>{imageButton("\u770b\u6392\u884c\u699c", "/generated-assets/ui-leaderboard-button.png", openLeaderboard, "secondary")}</div>}
        {status === "leaderboard" && <div className="overlay leaderboard-overlay"><h2>{"\u5168\u5c40\u6392\u884c\u699c"}</h2>{leaderboard.length === 0 ? <p>{"\u8fd8\u6ca1\u6709\u6210\u7ee9\u3002\u7b2c\u4e00\u676f\u5976\u8336\uff0c\u7b49\u4f60\u6765\u6447\u3002"}</p> : <ol className="leaderboard">{leaderboard.map((r, i) => <li key={r.date + r.score + i}><span className="rank">#{i + 1}</span><span className="record-main"><b>{r.name}</b><small>{r.result === "won" ? "\u80dc\u5229" : "\u5931\u8d25"} / {levelInfo(r.highestLevel).name} / {formatTime(r.elapsed)}</small></span><strong>{r.score}</strong></li>)}</ol>}<div className="button-row">{imageButton("\u5f00\u59cb\u6e38\u620f", "/generated-assets/ui-start-button.png", startGame)}{imageButton("\u8fd4\u56de", "/generated-assets/ui-cream-button.png", () => setStatus("menu"), "cream")}</div></div>}
      </section>
    </main>
  );
}








