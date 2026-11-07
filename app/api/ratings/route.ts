import { NextResponse } from "next/server";
import { pool } from "@manga/lib/db";

const validTypes = new Set(["words", "kanji", "grammar"]);
const validRatings = new Set(["Hard", "Good", "Easy"]);

export async function GET() {
  const { rows } = await pool.query<{ game_type: string; resource_id: string; rating: string }>(
    `SELECT game_type, resource_id, rating FROM japanese_game_ratings`,
  );
  return NextResponse.json(rows.map(({ game_type, resource_id, rating }) => ({
    type: game_type,
    id: resource_id,
    rating,
  })));
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body || !validTypes.has(body.type) || typeof body.id !== "string" || !validRatings.has(body.rating)) {
    return NextResponse.json({ error: "Dữ liệu phân loại không hợp lệ." }, { status: 400 });
  }

  await pool.query(
    `INSERT INTO japanese_game_ratings (game_type, resource_id, rating)
     VALUES ($1, $2, $3)
     ON CONFLICT (game_type, resource_id) DO UPDATE
     SET rating = EXCLUDED.rating, updated_at = NOW()`,
    [body.type, body.id, body.rating],
  );
  return NextResponse.json({ ok: true });
}
