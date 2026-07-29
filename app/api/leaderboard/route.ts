import { env } from "cloudflare:workers";

type ScoreRecord = {
  name: string;
  score: number;
  elapsed: number;
  highestLevel: number;
  result: "won" | "lost";
  date: string;
};

const jsonHeaders = {
  "content-type": "application/json; charset=utf-8",
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,POST,OPTIONS",
  "access-control-allow-headers": "content-type",
};

const clampText = (value: unknown, fallback: string, max = 24) =>
  String(typeof value === "string" && value.trim() ? value.trim() : fallback).slice(0, max);
const clampNumber = (value: unknown, min: number, max: number) =>
  Math.max(min, Math.min(max, Math.floor(Number(value) || 0)));

function normalizeRecord(value: Partial<ScoreRecord>): ScoreRecord {
  return {
    name: clampText(value.name, "\u533f\u540d\u5c0f\u6599", 12),
    score: clampNumber(value.score, 0, 999999999),
    elapsed: clampNumber(value.elapsed, 0, 24 * 60 * 60 * 1000),
    highestLevel: clampNumber(value.highestLevel, 1, 10),
    result: value.result === "won" ? "won" : "lost",
    date: clampText(value.date, new Date().toLocaleString("zh-CN"), 32),
  };
}

async function readRecords(): Promise<ScoreRecord[]> {
  if (!env.DB) return [];
  const { results } = await env.DB.prepare(
    `SELECT name, score, elapsed, highest_level AS highestLevel, result, date
     FROM leaderboard
     ORDER BY CASE result WHEN 'won' THEN 0 ELSE 1 END,
              highest_level DESC,
              score DESC,
              elapsed DESC,
              created_at DESC
     LIMIT 10`
  ).all<ScoreRecord>();
  return results ?? [];
}

export async function OPTIONS() {
  return new Response(null, { headers: jsonHeaders });
}

export async function GET() {
  try {
    return Response.json({ records: await readRecords() }, { headers: jsonHeaders });
  } catch {
    return Response.json({ records: [] }, { headers: jsonHeaders });
  }
}

export async function POST(request: Request) {
  try {
    if (!env.DB) return Response.json({ records: [] }, { headers: jsonHeaders, status: 503 });
    const record = normalizeRecord(await request.json());
    await env.DB.prepare(
      `INSERT INTO leaderboard (name, score, elapsed, highest_level, result, date)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
      .bind(record.name, record.score, record.elapsed, record.highestLevel, record.result, record.date)
      .run();
    return Response.json({ records: await readRecords() }, { headers: jsonHeaders });
  } catch {
    return Response.json({ records: [] }, { headers: jsonHeaders, status: 400 });
  }
}
