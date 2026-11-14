import { createHash, randomBytes } from "node:crypto";
import { pool } from "@manga/lib/db";

export const sessionCookie = "japanese_lab_session";
const sessionTtlSeconds = 60 * 60 * 24 * 30;

export type GardenUser = { id: string; username: string };

export function readCookie(request: Request, name: string) {
  const cookies = request.headers.get("cookie") || "";
  return cookies.match(new RegExp(`(?:^|;\\s*)${name}=([a-f0-9-]+)`))?.[1] || null;
}

export function sessionHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function newSessionToken() {
  return randomBytes(32).toString("hex");
}

export function sessionExpiry() {
  return new Date(Date.now() + sessionTtlSeconds * 1000);
}

export async function currentGardenUser(request: Request): Promise<GardenUser | null> {
  const token = readCookie(request, sessionCookie);
  if (!token) return null;
  const { rows } = await pool.query<GardenUser>(
    `SELECT u.id::text AS id, u.username
     FROM japanese_lab_sessions s
     JOIN japanese_lab_users u ON u.id = s.user_id
     WHERE s.session_hash = $1 AND s.expires_at > NOW()`,
    [sessionHash(token)],
  );
  return rows[0] || null;
}

export const sessionMaxAge = sessionTtlSeconds;
