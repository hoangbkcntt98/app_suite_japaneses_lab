"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiPath } from "@manga/lib/paths";
import styles from "./page.module.css";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const response = await fetch(apiPath(mode === "login" ? "/api/auth/session" : "/api/auth/register"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || "Không thể xác thực tài khoản.");
        return;
      }
      router.push("/games");
      router.refresh();
    } catch {
      setError("Không thể kết nối máy chủ.");
    } finally {
      setBusy(false);
    }
  }

  return <main className={styles.page}>
    <Link href="/games" className={styles.back}>← Japanese Lab</Link>
    <section className={styles.panel}>
      <span className={styles.kicker}>JAPANESE LAB · ACCOUNT</span>
      <h1>{mode === "login" ? "Chào mừng trở lại" : "Tạo tài khoản"}</h1>
      <p>Đăng nhập để đồng bộ XP và khu vườn giữa các thiết bị.</p>
      <div className={styles.tabs}>
        <button className={mode === "login" ? styles.active : ""} onClick={() => { setMode("login"); setError(""); }}>Đăng nhập</button>
        <button className={mode === "register" ? styles.active : ""} onClick={() => { setMode("register"); setError(""); }}>Đăng ký</button>
      </div>
      <form onSubmit={submit}>
        <label>Tên đăng nhập<input autoComplete="username" required minLength={3} maxLength={24} pattern="[a-zA-Z0-9_]+" value={username} onChange={(event) => setUsername(event.target.value)} /></label>
        <label>Mật khẩu<input type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} required minLength={10} maxLength={72} value={password} onChange={(event) => setPassword(event.target.value)} /></label>
        <small>3–24 ký tự cho tên; mật khẩu tối thiểu 10 ký tự.</small>
        {error ? <p className={styles.error} role="alert">{error}</p> : null}
        <button className={styles.submit} disabled={busy}>{busy ? "Đang xử lý..." : mode === "login" ? "Đăng nhập" : "Tạo tài khoản"}</button>
      </form>
    </section>
  </main>;
}
