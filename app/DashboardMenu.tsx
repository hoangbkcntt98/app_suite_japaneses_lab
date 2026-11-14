"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiPath } from "@manga/lib/paths";
import styles from "./page.module.css";

export default function DashboardMenu() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch(apiPath("/api/auth/session"))
      .then((response) => response.ok ? response.json() : null)
      .then((data) => setUsername(data?.username || ""))
      .catch(() => {});
  }, []);

  async function logout() {
    if (busy) return;
    setBusy(true);
    const response = await fetch(apiPath("/api/auth/session"), { method: "DELETE" }).catch(() => null);
    if (response?.ok) router.replace("/login");
    else setBusy(false);
  }

  return <details className={styles.accountMenu}>
    <summary className={styles.menuTrigger} aria-label="Mở menu tài khoản">
      <i /><i /><i />
    </summary>
    <div className={styles.menuPanel}>
      <span className={styles.menuUsername}>{username || "Đang tải tài khoản..."}</span>
      <button className={styles.menuLogout} onClick={() => void logout()} disabled={busy || !username}>
        {busy ? "Đang đăng xuất..." : "Đăng xuất"}
      </button>
    </div>
  </details>;
}
