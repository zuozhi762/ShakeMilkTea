"use client";

import { useEffect, useRef, useState } from "react";

const WIDTH = 390;
const HEIGHT = 700;
const CUP = { x: 34, y: 74, w: 322, h: 570, r: 30 };
const LEADERBOARD_KEY = "shake_milk_tea_leaderboard";

const LEVELS = [
  { level: 1, name: "西米", emoji: "⚪", scale: 1.0, color: "#fff8e7" },
  { level: 2, name: "芒果粒", emoji: "🟨", scale: 1.15, color: "#ffd447" },
  { level: 3, name: "椰果粒", emoji: "◻️", scale: 1.3, color: "#f8fafc" },
  { level: 4, name: "珍珠", emoji: "⚫", scale: 1.45, color: "#211817" },
  { level: 5, name: "红豆", emoji: "🫘", scale: 1.6, color: "#9b2f2f" },
  { level: 6, name: "布丁", emoji: "🍮", scale: 1.8, color: "#f3b347" },
  { level: 7, name: "仙草", emoji: "🟫", scale: 2.0, color: "#3f2925" },
  { level: 8, name: "芋圆", emoji: "🟣", scale: 2.25, color: "#a26be8" },
  { level: 9, name: "奶盖球", emoji: "🍥", scale: 2.5, color: "#ffe2ef" },
  { level: 10, name: "柿子", emoji: "🟠", scale: 2.8, color: "#ff8a1c" },
] as const;

type Status = "menu" | "playing" | "won" | "lost" | "leaderboard";
type EventKind = "idle" | "shakeWarning" | "shaking" | "strawWarning" | "strawActive";

type Topping = {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  level: number;
  radius: number;
  spin: number;
};

type Player = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  level: number;
  progress: number;
  radius: number;
};

type ActiveEvent = {
  kind: EventKind;
  until: number;
  started: number;
  applied?: boolean;
  x?: number;
  y?: number;
  forceX?: number;
  forceY?: number;
};

type Runtime = {
  running: boolean;
  startTime: number;
  lastTime: number;
  elapsed: number;
  score: number;
  highestLevel: number;
  nextId: number;
  nextShakeAt: number;
  nextStrawAt: number;
  lastSpawnAt: number;
  lastHudAt: number;
  player: Player;
  toppings: Topping[];
  target: { x: number; y: number; active: boolean };
  keys: Set<string>;
  event: ActiveEvent;
  shakeOffset: number;
  resultReason: string;
};

type Hud = {
  level: number;
  progress: number;
  score: number;
  elapsed: number;
  message: string;
};

type ScoreRecord = {
  name: string;
  score: number;
  elapsed: number;
  highestLevel: number;
  result: "won" | "lost";
  date: string;
};

type FinalStats = Omit<ScoreRecord, "name" | "date"> & { reason: string };

function levelInfo(level: number) {
  return LEVELS[Math.max(0, Math.min(LEVELS.length - 1, level - 1))];
}

function radiusForLevel(level: number) {
  return 8 * levelInfo(level).scale;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function rand(min: number, max: number) {
  return min + Math.random() * (max - min);
}

function dist(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function formatTime(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60).toString().padStart(2, "0");
  const s = (total % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

function loadLeaderboard(): ScoreRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(LEADERBOARD_KEY);
    return raw ? (JSON.parse(raw) as ScoreRecord[]) : [];
  } catch {
    return [];
  }
}

function sortLeaderboard(records: ScoreRecord[]) {
  return records
    .sort((a, b) => {
      if (a.result !== b.result) return a.result === "won" ? -1 : 1;
      if (a.highestLevel !== b.highestLevel) return b.highestLevel - a.highestLevel;
      if (a.score !== b.score) return b.score - a.score;
      return b.elapsed - a.elapsed;
    })
    .slice(0, 10);
}

function saveLeaderboard(record: ScoreRecord) {
  const next = sortLeaderboard([...loadLeaderboard(), record]);
  window.localStorage.setItem(LEADERBOARD_KEY, JSON.stringify(next));
  return next;
}

function isInsideCup(x: number, y: number, radius: number) {
  return (
    x >= CUP.x + radius &&
    x <= CUP.x + CUP.w - radius &&
    y >= CUP.y + radius &&
    y <= CUP.y + CUP.h - radius
  );
}

function randomCupPoint(radius: number) {
  return {
    x: rand(CUP.x + radius + 8, CUP.x + CUP.w - radius - 8),
    y: rand(CUP.y + radius + 8, CUP.y + CUP.h - radius - 8),
  };
}

function chooseSpawnLevel(playerLevel: number) {
  const maxLevel = Math.min(9, playerLevel + 2);
  const weights = Array.from({ length: maxLevel }, (_, i) => {
    const level = i + 1;
    const sameBonus = level === playerLevel ? 2.2 : 1;
    return Math.pow(maxLevel - level + 1, 1.35) * sameBonus;
  });
  const total = weights.reduce((sum, n) => sum + n, 0);
  let roll = Math.random() * total;
  for (let i = 0; i < weights.length; i += 1) {
    roll -= weights[i];
    if (roll <= 0) return i + 1;
  }
  return 1;
}

function createRuntime(): Runtime {
  const now = performance.now();
  const player: Player = {
    x: WIDTH / 2,
    y: HEIGHT - 130,
    vx: 0,
    vy: 0,
    level: 1,
    progress: 0,
    radius: radiusForLevel(1),
  };

  const runtime: Runtime = {
    running: true,
    startTime: now,
    lastTime: now,
    elapsed: 0,
    score: 0,
    highestLevel: 1,
    nextId: 1,
    nextShakeAt: 10000,
    nextStrawAt: 20000,
    lastSpawnAt: 0,
    lastHudAt: 0,
    player,
    toppings: [],
    target: { x: player.x, y: player.y, active: false },
    keys: new Set(),
    event: { kind: "idle", until: 0, started: now },
    shakeOffset: 0,
    resultReason: "",
  };

  addToppings(runtime, 12, 1);
  addToppings(runtime, 6, 2);
  addToppings(runtime, 3, 3);
  addToppings(runtime, 1, 4);
  return runtime;
}

function addToppings(runtime: Runtime, count: number, forcedLevel?: number) {
  for (let i = 0; i < count; i += 1) {
    const level = forcedLevel ?? chooseSpawnLevel(runtime.player.level);
    const radius = radiusForLevel(level);
    let point = randomCupPoint(radius);

    for (let attempts = 0; attempts < 40; attempts += 1) {
      point = randomCupPoint(radius);
      if (dist(point, runtime.player) > runtime.player.radius + radius + 42) break;
    }

    runtime.toppings.push({
      id: runtime.nextId,
      x: point.x,
      y: point.y,
      vx: rand(-28, 28),
      vy: rand(-28, 28),
      level,
      radius,
      spin: rand(0, Math.PI * 2),
    });
    runtime.nextId += 1;
  }
}

function eventMessage(event: ActiveEvent) {
  switch (event.kind) {
    case "shakeWarning":
      return "⚠️ 奶茶要被摇啦！";
    case "shaking":
      return "🧋 摇摇摇！小料全乱跑了！";
    case "strawWarning":
      return "⚠️ 吸管要来了，快躲开红圈！";
    case "strawActive":
      return "🥤 吸管正在吸！别靠太近！";
    default:
      return "吃 3 个同级小料就能进化。";
  }
}

function triggerShake(runtime: Runtime, now: number) {
  const angle = rand(0, Math.PI * 2);
  const strength = rand(90, 150) * (1 + Math.min(runtime.elapsed / 180000, 0.6));
  runtime.event = {
    kind: "shakeWarning",
    until: now + 1000,
    started: now,
    forceX: Math.cos(angle) * strength,
    forceY: Math.sin(angle) * strength,
  };
}

function triggerStraw(runtime: Runtime, now: number) {
  const radius = 28;
  const point = randomCupPoint(radius);
  point.y = rand(CUP.y + 90, CUP.y + CUP.h - 130);
  runtime.event = {
    kind: "strawWarning",
    until: now + 1500,
    started: now,
    x: point.x,
    y: point.y,
  };
}

function strawCenter(runtime: Runtime, now: number) {
  const event = runtime.event;
  const baseX = event.x ?? WIDTH / 2;
  const baseY = event.y ?? CUP.y + 220;
  const difficulty = Math.min(runtime.elapsed / 180000, 1);
  const wobble = runtime.elapsed > 60000 ? Math.sin(now / 470) * 35 * difficulty : 0;
  const swirl = runtime.elapsed > 110000 ? Math.cos(now / 620) * 30 * difficulty : 0;
  return {
    x: clamp(baseX + wobble, CUP.x + 36, CUP.x + CUP.w - 36),
    y: clamp(baseY + swirl, CUP.y + 80, CUP.y + CUP.h - 80),
  };
}

function keepInCup(item: { x: number; y: number; vx: number; vy: number; radius: number }) {
  if (item.x < CUP.x + item.radius) {
    item.x = CUP.x + item.radius;
    item.vx = Math.abs(item.vx) * 0.75;
  }
  if (item.x > CUP.x + CUP.w - item.radius) {
    item.x = CUP.x + CUP.w - item.radius;
    item.vx = -Math.abs(item.vx) * 0.75;
  }
  if (item.y < CUP.y + item.radius) {
    item.y = CUP.y + item.radius;
    item.vy = Math.abs(item.vy) * 0.75;
  }
  if (item.y > CUP.y + CUP.h - item.radius) {
    item.y = CUP.y + CUP.h - item.radius;
    item.vy = -Math.abs(item.vy) * 0.75;
  }
}

function drawRoundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawIngredient(ctx: CanvasRenderingContext2D, item: { x: number; y: number; radius: number; level: number }, isPlayer = false) {
  const info = levelInfo(item.level);
  ctx.save();
  ctx.translate(item.x, item.y);

  const aura = isPlayer ? 9 : 3;
  const glow = isPlayer ? "rgba(255, 244, 166, 0.55)" : "rgba(255, 255, 255, 0.18)";
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, 0, item.radius + aura, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = isPlayer ? "rgba(255, 255, 255, 0.92)" : "rgba(255, 255, 255, 0.68)";
  ctx.beginPath();
  ctx.arc(0, 0, item.radius + 2, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = info.color;
  ctx.beginPath();
  ctx.arc(0, 0, item.radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.font = `${Math.round(item.radius * 1.6)}px "Apple Color Emoji", "Segoe UI Emoji", sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(info.emoji, 0, 1);

  if (isPlayer) {
    ctx.strokeStyle = "rgba(126, 60, 16, 0.9)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, item.radius + 5, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.restore();
}

function drawScene(ctx: CanvasRenderingContext2D, runtime: Runtime | null, status: Status) {
  ctx.clearRect(0, 0, WIDTH, HEIGHT);

  const bg = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
  bg.addColorStop(0, "#fff2c9");
  bg.addColorStop(0.45, "#f6c879");
  bg.addColorStop(1, "#a96735");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  ctx.fillStyle = "rgba(255,255,255,0.18)";
  for (let i = 0; i < 24; i += 1) {
    ctx.beginPath();
    ctx.arc((i * 61) % WIDTH, 58 + ((i * 97) % 600), 2 + (i % 4), 0, Math.PI * 2);
    ctx.fill();
  }

  const offset = runtime?.shakeOffset ?? 0;
  ctx.save();
  ctx.translate(offset, 0);

  drawRoundedRect(ctx, CUP.x - 8, CUP.y - 8, CUP.w + 16, CUP.h + 16, CUP.r + 8);
  ctx.fillStyle = "rgba(255, 255, 255, 0.28)";
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.78)";
  ctx.lineWidth = 4;
  ctx.stroke();

  drawRoundedRect(ctx, CUP.x, CUP.y, CUP.w, CUP.h, CUP.r);
  const tea = ctx.createLinearGradient(0, CUP.y, 0, CUP.y + CUP.h);
  tea.addColorStop(0, "rgba(255, 221, 153, 0.78)");
  tea.addColorStop(0.55, "rgba(189, 119, 63, 0.82)");
  tea.addColorStop(1, "rgba(117, 66, 37, 0.88)");
  ctx.fillStyle = tea;
  ctx.fill();

  ctx.save();
  drawRoundedRect(ctx, CUP.x, CUP.y, CUP.w, CUP.h, CUP.r);
  ctx.clip();
  const waveShift = runtime ? runtime.elapsed / 420 : 0;
  ctx.strokeStyle = "rgba(255,255,255,0.22)";
  ctx.lineWidth = 2;
  for (let line = 0; line < 7; line += 1) {
    ctx.beginPath();
    const y = CUP.y + 70 + line * 72;
    for (let x = CUP.x - 10; x <= CUP.x + CUP.w + 10; x += 12) {
      const wy = y + Math.sin((x + waveShift + line * 33) / 22) * 5;
      if (x === CUP.x - 10) ctx.moveTo(x, wy);
      else ctx.lineTo(x, wy);
    }
    ctx.stroke();
  }

  if (runtime) {
    if (runtime.event.kind === "strawWarning" || runtime.event.kind === "strawActive") {
      const c = runtime.event.kind === "strawActive" ? strawCenter(runtime, performance.now()) : { x: runtime.event.x ?? WIDTH / 2, y: runtime.event.y ?? 240 };
      ctx.fillStyle = runtime.event.kind === "strawActive" ? "rgba(255, 52, 88, 0.16)" : "rgba(255, 52, 88, 0.22)";
      ctx.beginPath();
      ctx.arc(c.x, c.y, 128, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(255, 52, 88, 0.5)";
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 8]);
      ctx.beginPath();
      ctx.arc(c.x, c.y, 32, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      if (runtime.event.kind === "strawActive") {
        for (let ring = 0; ring < 4; ring += 1) {
          ctx.strokeStyle = `rgba(255,255,255,${0.34 - ring * 0.06})`;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(c.x, c.y, 26 + ring * 24 + Math.sin(runtime.elapsed / 140 + ring) * 4, 0.2 + ring, Math.PI * 1.55 + ring);
          ctx.stroke();
        }
      }
    }

    runtime.toppings
      .slice()
      .sort((a, b) => a.level - b.level)
      .forEach((item) => drawIngredient(ctx, item));
    drawIngredient(ctx, runtime.player, true);

    if (runtime.event.kind === "strawActive") {
      const c = strawCenter(runtime, performance.now());
      ctx.save();
      ctx.lineCap = "round";
      ctx.lineWidth = 18;
      ctx.strokeStyle = "#ff7b93";
      ctx.beginPath();
      ctx.moveTo(c.x - 42, CUP.y - 52);
      ctx.lineTo(c.x, c.y);
      ctx.stroke();
      ctx.lineWidth = 7;
      ctx.strokeStyle = "rgba(255,255,255,0.9)";
      ctx.setLineDash([18, 18]);
      ctx.beginPath();
      ctx.moveTo(c.x - 42, CUP.y - 52);
      ctx.lineTo(c.x, c.y);
      ctx.stroke();
      ctx.restore();
    }
  } else {
    ctx.font = "68px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("🧋", WIDTH / 2, HEIGHT / 2 - 20);
  }

  ctx.restore();

  ctx.fillStyle = "rgba(77, 39, 20, 0.18)";
  ctx.fillRect(0, HEIGHT - 28, WIDTH, 28);

  if (status !== "playing") {
    ctx.fillStyle = "rgba(67, 31, 16, 0.22)";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
  }
}

function updateRuntime(runtime: Runtime, dt: number, now: number, finish: (result: "won" | "lost", reason: string) => void) {
  runtime.elapsed = now - runtime.startTime;
  const player = runtime.player;
  const difficulty = Math.min(runtime.elapsed / 180000, 1);

  if (runtime.event.kind === "idle") {
    if (runtime.elapsed >= runtime.nextShakeAt) {
      triggerShake(runtime, now);
    } else if (runtime.elapsed >= runtime.nextStrawAt) {
      triggerStraw(runtime, now);
    }
  } else if (runtime.event.kind === "shakeWarning" && now >= runtime.event.until) {
    runtime.event = { ...runtime.event, kind: "shaking", until: now + 1250, started: now };
  } else if (runtime.event.kind === "shaking" && now >= runtime.event.until) {
    runtime.score += 100;
    runtime.event = { kind: "idle", until: 0, started: now };
    runtime.nextShakeAt = runtime.elapsed + rand(15000 - difficulty * 5000, 25000 - difficulty * 7000);
  } else if (runtime.event.kind === "strawWarning" && now >= runtime.event.until) {
    runtime.event = { ...runtime.event, kind: "strawActive", until: now + 4600, started: now };
  } else if (runtime.event.kind === "strawActive" && now >= runtime.event.until) {
    runtime.score += 200;
    runtime.event = { kind: "idle", until: 0, started: now };
    runtime.nextStrawAt = runtime.elapsed + rand(21000 - difficulty * 6000, 34000 - difficulty * 9000);
  }

  const keyX = (runtime.keys.has("arrowright") || runtime.keys.has("d") ? 1 : 0) - (runtime.keys.has("arrowleft") || runtime.keys.has("a") ? 1 : 0);
  const keyY = (runtime.keys.has("arrowdown") || runtime.keys.has("s") ? 1 : 0) - (runtime.keys.has("arrowup") || runtime.keys.has("w") ? 1 : 0);
  let dirX = keyX;
  let dirY = keyY;

  if (dirX === 0 && dirY === 0 && runtime.target.active) {
    const dx = runtime.target.x - player.x;
    const dy = runtime.target.y - player.y;
    const len = Math.hypot(dx, dy);
    if (len > 4) {
      dirX = dx / len;
      dirY = dy / len;
    }
  } else if (dirX || dirY) {
    const len = Math.hypot(dirX, dirY);
    dirX /= len;
    dirY /= len;
  }

  const speedPenalty = (levelInfo(player.level).scale - 1) * 15;
  const accel = 760;
  const maxSpeed = 178 - speedPenalty;
  player.vx += dirX * accel * dt;
  player.vy += dirY * accel * dt;
  const pSpeed = Math.hypot(player.vx, player.vy);
  if (pSpeed > maxSpeed) {
    player.vx = (player.vx / pSpeed) * maxSpeed;
    player.vy = (player.vy / pSpeed) * maxSpeed;
  }

  if (runtime.event.kind === "shaking") {
    const fx = runtime.event.forceX ?? 0;
    const fy = runtime.event.forceY ?? 0;
    const pulse = Math.sin((now - runtime.event.started) / 70);
    player.vx += fx * dt * 1.1;
    player.vy += fy * dt * 1.1;
    runtime.shakeOffset = pulse * 8;
    for (const item of runtime.toppings) {
      item.vx += fx * dt * rand(0.6, 1.3);
      item.vy += fy * dt * rand(0.6, 1.3);
    }
  } else {
    runtime.shakeOffset *= 0.75;
  }

  if (runtime.event.kind === "strawActive") {
    const c = strawCenter(runtime, now);
    const dangerRadius = 26 + difficulty * 8;
    const pullRadius = 134 + difficulty * 30;
    const pull = 118 + difficulty * 85;
    const dPlayer = dist(player, c);
    if (dPlayer < dangerRadius + player.radius * 0.55) {
      finish("lost", "你被吸管吸走了");
      return;
    }
    if (dPlayer < pullRadius) {
      const power = (1 - dPlayer / pullRadius) * pull;
      player.vx += ((c.x - player.x) / Math.max(1, dPlayer)) * power * dt;
      player.vy += ((c.y - player.y) / Math.max(1, dPlayer)) * power * dt;
    }

    runtime.toppings = runtime.toppings.filter((item) => {
      const d = dist(item, c);
      if (d < dangerRadius + item.radius * 0.3) return false;
      if (d < pullRadius) {
        const power = (1 - d / pullRadius) * pull * 0.85;
        item.vx += ((c.x - item.x) / Math.max(1, d)) * power * dt;
        item.vy += ((c.y - item.y) / Math.max(1, d)) * power * dt;
      }
      return true;
    });
  }

  const damping = Math.pow(0.9, dt * 60);
  player.vx *= damping;
  player.vy *= damping;
  player.x += player.vx * dt;
  player.y += player.vy * dt;
  keepInCup(player);

  for (const item of runtime.toppings) {
    const wander = 10 + item.level * 1.6;
    item.vx += Math.cos(now / 900 + item.spin) * wander * dt;
    item.vy += Math.sin(now / 1100 + item.spin) * wander * dt;
    const maxItemSpeed = 34 + item.level * 3 + difficulty * 16;
    const speed = Math.hypot(item.vx, item.vy);
    if (speed > maxItemSpeed) {
      item.vx = (item.vx / speed) * maxItemSpeed;
      item.vy = (item.vy / speed) * maxItemSpeed;
    }
    item.x += item.vx * dt;
    item.y += item.vy * dt;
    keepInCup(item);
  }

  for (let i = runtime.toppings.length - 1; i >= 0; i -= 1) {
    const item = runtime.toppings[i];
    if (!isInsideCup(item.x, item.y, item.radius)) continue;
    if (dist(player, item) < player.radius + item.radius * 0.72) {
      if (item.level > player.level) {
        finish("lost", `撞上了更大的${levelInfo(item.level).name}`);
        return;
      }

      runtime.toppings.splice(i, 1);
      if (item.level === player.level) {
        runtime.score += item.level * 20;
        player.progress += 1;
        if (player.progress >= 3) {
          player.level += 1;
          player.progress = 0;
          player.radius = radiusForLevel(player.level);
          runtime.highestLevel = Math.max(runtime.highestLevel, player.level);
          runtime.score += player.level * 100;
          player.vx *= 0.35;
          player.vy *= 0.35;
          if (player.level >= 10) {
            runtime.score += 3000;
            finish("won", "你合成了传说中的柿子");
            return;
          }
        }
      } else {
        runtime.score += item.level * 10;
      }
    }
  }

  if (runtime.elapsed - runtime.lastSpawnAt > 2600) {
    runtime.lastSpawnAt = runtime.elapsed;
    const desired = 28 + Math.round(difficulty * 10);
    if (runtime.toppings.length < desired) {
      addToppings(runtime, Math.min(5, desired - runtime.toppings.length));
    }
  }
}

export function MilkTeaGame() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const runtimeRef = useRef<Runtime | null>(null);
  const [status, setStatus] = useState<Status>("menu");
  const [hud, setHud] = useState<Hud>({ level: 1, progress: 0, score: 0, elapsed: 0, message: "吃 3 个同级小料就能进化。" });
  const [finalStats, setFinalStats] = useState<FinalStats | null>(null);
  const [leaderboard, setLeaderboard] = useState<ScoreRecord[]>([]);
  const [playerName, setPlayerName] = useState("匿名小料");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setLeaderboard(loadLeaderboard());
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (["arrowup", "arrowdown", "arrowleft", "arrowright", "w", "a", "s", "d"].includes(key)) {
        event.preventDefault();
        runtimeRef.current?.keys.add(key);
      }
    };
    const onKeyUp = (event: KeyboardEvent) => {
      runtimeRef.current?.keys.delete(event.key.toLowerCase());
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx || !canvas) return;

    let frame = 0;
    const finish = (result: "won" | "lost", reason: string) => {
      const runtime = runtimeRef.current;
      if (!runtime || !runtime.running) return;
      runtime.running = false;
      const stats = {
        result,
        reason,
        score: runtime.score,
        elapsed: runtime.elapsed,
        highestLevel: runtime.highestLevel,
      };
      setFinalStats(stats);
      setSaved(false);
      setStatus(result);
    };

    const loop = (now: number) => {
      const runtime = runtimeRef.current;
      if (!runtime || !runtime.running) return;
      const dt = Math.min(0.033, Math.max(0.001, (now - runtime.lastTime) / 1000));
      runtime.lastTime = now;
      updateRuntime(runtime, dt, now, finish);
      drawScene(ctx, runtime, "playing");

      if (now - runtime.lastHudAt > 100) {
        runtime.lastHudAt = now;
        setHud({
          level: runtime.player.level,
          progress: runtime.player.progress,
          score: runtime.score,
          elapsed: runtime.elapsed,
          message: eventMessage(runtime.event),
        });
      }
      frame = window.requestAnimationFrame(loop);
    };

    if (status === "playing") {
      frame = window.requestAnimationFrame(loop);
    } else {
      drawScene(ctx, runtimeRef.current, status);
    }

    return () => window.cancelAnimationFrame(frame);
  }, [status]);

  const startGame = () => {
    const runtime = createRuntime();
    runtimeRef.current = runtime;
    setFinalStats(null);
    setSaved(false);
    setHud({ level: 1, progress: 0, score: 0, elapsed: 0, message: "吃 3 个同级小料就能进化。" });
    setStatus("playing");
  };

  const openLeaderboard = () => {
    setLeaderboard(loadLeaderboard());
    setStatus("leaderboard");
  };

  const handlePointer = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const runtime = runtimeRef.current;
    if (!canvas || !runtime) return;
    const rect = canvas.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * WIDTH;
    const y = ((event.clientY - rect.top) / rect.height) * HEIGHT;
    runtime.target = {
      x: clamp(x, CUP.x, CUP.x + CUP.w),
      y: clamp(y, CUP.y, CUP.y + CUP.h),
      active: true,
    };
  };

  const stopPointer = () => {
    if (runtimeRef.current) runtimeRef.current.target.active = false;
  };

  const persistScore = () => {
    if (!finalStats || saved) return;
    const cleanName = playerName.trim() || "匿名小料";
    const next = saveLeaderboard({
      name: cleanName.slice(0, 12),
      score: finalStats.score,
      elapsed: finalStats.elapsed,
      highestLevel: finalStats.highestLevel,
      result: finalStats.result,
      date: new Date().toLocaleString("zh-CN"),
    });
    setLeaderboard(next);
    setSaved(true);
  };

  const current = levelInfo(hud.level);
  const next = hud.level < 10 ? levelInfo(hud.level + 1) : null;
  const finalLevelName = finalStats ? levelInfo(finalStats.highestLevel).name : current.name;

  return (
    <main className="game-shell">
      <section className="hero-panel" aria-label="游戏介绍">
        <p className="eyebrow">Milk Tea Merge Survival</p>
        <h1>摇摇奶茶大合成</h1>
        <p className="intro">
          从一颗西米开始，在晃动的奶茶杯里吞掉同级小料进化，躲开更大的小料和会吸人的吸管，最终合成传说中的柿子。
        </p>
        <div className="rules-card">
          <span>同级 × 3 = 进化</span>
          <span>等级越高，体型越大</span>
          <span>吸管碰到玩家即失败</span>
        </div>
      </section>

      <section className="phone-frame" aria-label="摇摇奶茶大合成游戏区">
        <div className="hud top-hud">
          <div>
            <small>当前</small>
            <strong>{current.emoji} {current.name}</strong>
          </div>
          <div>
            <small>进度</small>
            <strong>{hud.progress}/3</strong>
          </div>
          <div>
            <small>时间</small>
            <strong>{formatTime(hud.elapsed)}</strong>
          </div>
        </div>

        <canvas
          ref={canvasRef}
          width={WIDTH}
          height={HEIGHT}
          className="game-canvas"
          onPointerDown={handlePointer}
          onPointerMove={handlePointer}
          onPointerUp={stopPointer}
          onPointerCancel={stopPointer}
          onPointerLeave={stopPointer}
          aria-label="奶茶杯游戏画面"
        />

        <div className="hud bottom-hud">
          <span>{hud.message}</span>
          <b>{hud.score} 分</b>
        </div>

        {status === "menu" && (
          <div className="overlay menu-overlay">
            <div className="logo-bubble">🧋</div>
            <h2>准备开摇！</h2>
            <p>鼠标、触摸或 WASD 控制小料移动。吃 3 个同级小料就能进化。</p>
            <button onClick={startGame}>开始游戏</button>
            <button className="secondary" onClick={openLeaderboard}>查看排行榜</button>
          </div>
        )}

        {(status === "won" || status === "lost") && finalStats && (
          <div className={`overlay result-overlay ${status === "won" ? "win" : "lose"}`}>
            <div className="logo-bubble">{status === "won" ? "🟠" : "🥤"}</div>
            <h2>{status === "won" ? "超级无敌好喝地胜利！" : "这杯有点太刺激了"}</h2>
            <p className="reason">{finalStats.reason}</p>
            <div className="stat-grid">
              <span>坚持时间 <b>{formatTime(finalStats.elapsed)}</b></span>
              <span>最高等级 <b>{finalLevelName}</b></span>
              <span>最终分数 <b>{finalStats.score}</b></span>
            </div>
            <label className="name-input">
              排行榜昵称
              <input value={playerName} maxLength={12} onChange={(event) => setPlayerName(event.target.value)} />
            </label>
            <div className="button-row">
              <button onClick={persistScore} disabled={saved}>{saved ? "已保存" : "保存成绩"}</button>
              <button className="secondary" onClick={startGame}>再来一局</button>
            </div>
            <button className="ghost" onClick={openLeaderboard}>看排行榜</button>
          </div>
        )}

        {status === "leaderboard" && (
          <div className="overlay leaderboard-overlay">
            <h2>本地排行榜</h2>
            {leaderboard.length === 0 ? (
              <p>还没有成绩。第一杯奶茶，等你来摇。</p>
            ) : (
              <ol className="leaderboard">
                {leaderboard.map((record, index) => (
                  <li key={`${record.date}-${record.score}-${index}`}>
                    <span className="rank">#{index + 1}</span>
                    <span className="record-main">
                      <b>{record.name}</b>
                      <small>{record.result === "won" ? "胜利" : "失败"} · {levelInfo(record.highestLevel).name} · {formatTime(record.elapsed)}</small>
                    </span>
                    <strong>{record.score}</strong>
                  </li>
                ))}
              </ol>
            )}
            <div className="button-row">
              <button onClick={startGame}>开始游戏</button>
              <button className="secondary" onClick={() => setStatus("menu")}>返回首页</button>
            </div>
          </div>
        )}
      </section>

      <aside className="side-panel" aria-label="成长路线">
        <h2>小料进化路线</h2>
        <p>玩家等级提升时，视觉半径和 emoji 整体同步放大，后期更威风，也更容易被吸管抓住。</p>
        <div className="evolution-list">
          {LEVELS.map((item) => (
            <div className={item.level === hud.level ? "active" : ""} key={item.level}>
              <span style={{ fontSize: `${14 + item.scale * 5}px` }}>{item.emoji}</span>
              <b>{item.name}</b>
              <small>×{item.scale.toFixed(2)}</small>
            </div>
          ))}
        </div>
        <div className="next-card">
          <small>下一目标</small>
          <strong>{next ? `${next.emoji} ${next.name}` : "已经是传说柿子"}</strong>
        </div>
      </aside>
    </main>
  );
}
