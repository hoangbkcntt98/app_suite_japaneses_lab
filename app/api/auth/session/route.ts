import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { pool } from "@manga/lib/db";
import {
  currentGardenUser,
  newSessionToken,
  readCookie,
  sessionCookie,
  sessionExpiry,
  sessionHash,
  sessionMaxAge,
} from "@manga/lib/auth/garden-auth";

function sessionResponse(token: string, username: string) {
  const response = NextResponse.json({ username });
  response.cookies.set(sessionCookie, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: sessionMaxAge,
  });
  return response;
}

export async function GET(request: Request) {
  const user = await currentGardenUser(request);
  return NextResponse.json(user ? { username: user.username } : { username: null });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const username = typeof body?.username === "string" ? body.username.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  if (!/^[a-zA-Z0-9_]{3,24}$/.test(username) || password.length < 10 || Buffer.byteLength(password, "utf8") > 72) {
    return NextResponse.json({ error: "Tên đăng nhập 3–24 ký tự; mật khẩu cần 10–72 ký tự." }, { status: 400 });
  }

  const { rows } = await pool.query<{ id: string; username: string; password_hash: string }>(
    `SELECT id::text AS id, username, password_hash
     FROM japanese_lab_users WHERE username = $1`,
    [username],
  );
  const user = rows[0];
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    return NextResponse.json({ error: "Tên đăng nhập hoặc mật khẩu không đúng." }, { status: 401 });
  }

  const token = newSessionToken();
  await pool.query(
    `INSERT INTO japanese_lab_sessions (session_hash, user_id, expires_at)
     VALUES ($1, $2, $3)`,
    [sessionHash(token), user.id, sessionExpiry()],
  );
  return sessionResponse(token, user.username);
}

export async function DELETE(request: Request) {
  const token = readCookie(request, sessionCookie);
  if (token) {
    await pool.query(`DELETE FROM japanese_lab_sessions WHERE session_hash = $1`, [sessionHash(token)]);
  }
  const response = NextResponse.json({ ok: true });
  response.cookies.set(sessionCookie, "", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 0 });
  return response;
}
