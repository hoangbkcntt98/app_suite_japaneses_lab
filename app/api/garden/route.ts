import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { pool } from "@manga/lib/db";
import { currentGardenUser, readCookie } from "@manga/lib/auth/garden-auth";

const cookieName = "japanese_lab_player";
const plantKindList = ["oak", "pine", "cherry", "apple", "orange", "maple"] as const;
const plantKinds = new Set([...plantKindList, "sakura", "bamboo", "bonsai"]);
const itemKinds = ["hoe", "wateringCan", "fertilizer", "superFertilizer", "pesticide"] as const;
const maxXp = Number.MAX_SAFE_INTEGER;

type GardenState = {
  xp: number;
  landCount: number;
  plants: { id: string; kind: string; growth: number; landIndex: number; protected?: boolean; plantedAt?: string }[];
  seeds: Record<string, number>;
  items: Record<string, number>;
};

function withPlayerCookie(response: NextResponse, id: string) {
  response.cookies.set(cookieName, id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return response;
}

function validateState(value: unknown): GardenState | null {
  if (!value || typeof value !== "object") return null;
  const state = value as Partial<GardenState>;
  if (!Number.isSafeInteger(state.xp) || Number(state.xp) < 0 || Number(state.xp) > maxXp) return null;
  if (state.landCount !== undefined && (!Number.isSafeInteger(state.landCount) || Number(state.landCount) < 0 || Number(state.landCount) > maxXp - 10)) return null;
  if (!Array.isArray(state.plants) || state.plants.length > 500) return null;
  if (!state.items || typeof state.items !== "object") return null;
  if (state.seeds !== undefined && (!state.seeds || typeof state.seeds !== "object")) return null;
  const seeds = Object.fromEntries(plantKindList.map((kind) => {
    const count = state.seeds?.[kind] ?? 0;
    return [kind, count];
  })) as Record<(typeof plantKindList)[number], number>;
  if (plantKindList.some((kind) => !Number.isInteger(seeds[kind]) || seeds[kind] < 0 || seeds[kind] > 10000)) return null;
  const items = Object.fromEntries(itemKinds.map((kind) => {
    const count = state.items?.[kind] ?? 0;
    return [kind, count];
  })) as Record<(typeof itemKinds)[number], number>;
  if (itemKinds.some((kind) => !Number.isInteger(items[kind]) || items[kind] < 0 || items[kind] > 10000)) return null;
  const plants = state.plants.map((plant, index) => {
    if (!plant || typeof plant.id !== "string" || plant.id.length > 100
      || !plantKinds.has(plant.kind) || !Number.isFinite(plant.growth)
      || (plant.landIndex !== undefined && (!Number.isSafeInteger(plant.landIndex) || plant.landIndex < 0))
      || (plant.protected !== undefined && typeof plant.protected !== "boolean")
      || (plant.plantedAt !== undefined && (typeof plant.plantedAt !== "string" || plant.plantedAt.length > 40 || Number.isNaN(Date.parse(plant.plantedAt))))) return null;
    return {
      id: plant.id,
      kind: plant.kind,
      growth: Math.max(0, Math.min(100, plant.growth)),
      landIndex: plant.landIndex ?? index,
      protected: plant.protected === true,
      plantedAt: plant.plantedAt || new Date().toISOString(),
    };
  });
  if (plants.some((plant) => !plant)) return null;
  const validPlants = plants as GardenState["plants"];
  const landCount = Math.max(Number(state.landCount) || 0, ...validPlants.map((plant) => plant.landIndex + 1));
  if (!Number.isSafeInteger(landCount) || landCount > maxXp - 10) return null;
  return {
    xp: Number(state.xp),
    landCount,
    plants: validPlants,
    seeds,
    items,
  };
}

export async function GET(request: Request) {
  const user = await currentGardenUser(request);
  if (!user) return NextResponse.json({ error: "Cần đăng nhập." }, { status: 401 });
  const existingId = readCookie(request, cookieName);
  const id = existingId || randomUUID();
  const ownerId = `account:${user.id}`;
  if (existingId) {
    await pool.query(
      `INSERT INTO japanese_lab_gardens (player_id, state)
       SELECT $1, state FROM japanese_lab_gardens WHERE player_id = $2
       ON CONFLICT (player_id) DO NOTHING`,
      [ownerId, existingId],
    );
  }
  const { rows } = await pool.query<{ state: GardenState }>(
    `SELECT state FROM japanese_lab_gardens WHERE player_id = $1`,
    [ownerId],
  );
  const response = NextResponse.json(rows[0]?.state || {
    xp: 0,
    landCount: 0,
    plants: [],
    seeds: { oak: 0, pine: 0, cherry: 0, apple: 0, orange: 0, maple: 0 },
    items: { hoe: 0, wateringCan: 0, fertilizer: 0, superFertilizer: 0, pesticide: 0 },
  });
  return existingId ? response : withPlayerCookie(response, id);
}

export async function PUT(request: Request) {
  const user = await currentGardenUser(request);
  if (!user) return NextResponse.json({ error: "Cần đăng nhập." }, { status: 401 });
  const ownerId = `account:${user.id}`;
  const state = validateState(await request.json().catch(() => null));
  if (!state) return NextResponse.json({ error: "Dữ liệu khu vườn không hợp lệ." }, { status: 400 });

  await pool.query(
    `INSERT INTO japanese_lab_gardens (player_id, state, updated_at)
     VALUES ($1, $2::jsonb, NOW())
     ON CONFLICT (player_id) DO UPDATE
     SET state = EXCLUDED.state, updated_at = NOW()`,
    [ownerId, JSON.stringify(state)],
  );
  return NextResponse.json({ ok: true });
}

export async function POST(request: Request) {
  const user = await currentGardenUser(request);
  if (!user) return NextResponse.json({ error: "Cần đăng nhập." }, { status: 401 });
  const body = await request.json().catch(() => null);
  if (body?.action !== "correctAnswer") {
    return NextResponse.json({ error: "Thao tác không hợp lệ." }, { status: 400 });
  }

  const ownerId = `account:${user.id}`;
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO japanese_lab_gardens (player_id)
       VALUES ($1) ON CONFLICT (player_id) DO NOTHING`,
      [ownerId],
    );
    const { rows } = await client.query<{ state: GardenState }>(
      `SELECT state FROM japanese_lab_gardens WHERE player_id = $1 FOR UPDATE`,
      [ownerId],
    );
    const state = rows[0].state;
    state.xp = Math.min(maxXp, Math.max(0, Number(state.xp) || 0) + 10);
    // Trả lời đúng chỉ thưởng XP. Cây chỉ lớn khi dùng vật phẩm chăm sóc.
    state.plants = Array.isArray(state.plants)
      ? state.plants.map((plant, index) => ({
        ...plant,
        landIndex: Number.isInteger(plant.landIndex) ? plant.landIndex : index,
        growth: Math.min(100, Math.max(0, Number(plant.growth) || 0)),
      }))
      : [];
    if (!Number.isInteger(state.landCount)) state.landCount = state.plants.length;
    await client.query(
      `UPDATE japanese_lab_gardens SET state = $2::jsonb, updated_at = NOW() WHERE player_id = $1`,
      [ownerId, JSON.stringify(state)],
    );
    await client.query("COMMIT");
    return NextResponse.json({ ok: true });
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}
