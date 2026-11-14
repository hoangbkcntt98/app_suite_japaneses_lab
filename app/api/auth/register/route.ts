import bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { pool } from "@manga/lib/db";
import {
  newSessionToken,
  sessionCookie,
  sessionExpiry,
  sessionHash,
  sessionMaxAge,
} from "@manga/lib/auth/garden-auth";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const username = typeof body?.username === "string" ? body.username.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  if (!/^[a-zA-Z0-9_]{3,24}$/.test(username) || password.length < 10 || Buffer.byteLength(password, "utf8") > 72) {
    return NextResponse.json({ error: "Tên đăng nhập 3–24 ký tự; mật khẩu cần 10–72 ký tự." }, { status: 400 });
  }

  const id = randomUUID();
  const passwordHash = await bcrypt.hash(password, 12);
  const token = newSessionToken();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO japanese_lab_users (id, username, password_hash)
       VALUES ($1, $2, $3)`,
      [id, username, passwordHash],
    );
    await client.query(
      `INSERT INTO japanese_lab_sessions (session_hash, user_id, expires_at)
       VALUES ($1, $2, $3)`,
      [sessionHash(token), id, sessionExpiry()],
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    if (typeof error === "object" && error !== null && "code" in error && error.code === "23505") {
      return NextResponse.json({ error: "Tên đăng nhập này đã được sử dụng." }, { status: 409 });
    }
    throw error;
  } finally {
    client.release();
  }

  const response = NextResponse.json({ username }, { status: 201 });
  response.cookies.set(sessionCookie, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: sessionMaxAge,
  });
  return response;
}
