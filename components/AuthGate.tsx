"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { apiPath } from "@manga/lib/paths";

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [allowedPath, setAllowedPath] = useState<string | null>(null);
  const publicRoute = pathname === "/login" || pathname?.endsWith("/login");

  useEffect(() => {
    if (publicRoute) return;
    let active = true;
    fetch(apiPath("/api/auth/session"))
      .then((response) => response.ok ? response.json() : null)
      .then((data) => {
        if (!active) return;
        if (data?.username) setAllowedPath(pathname || "/");
        else router.replace(`/login?next=${encodeURIComponent(pathname || "/")}`);
      })
      .catch(() => {
        if (active) router.replace("/login");
      });
    return () => { active = false; };
  }, [pathname, publicRoute, router]);

  if (publicRoute || allowedPath === (pathname || "/")) return <>{children}</>;
  return <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", color: "#315c3f", background: "#f7f6ee", fontFamily: "Arial, sans-serif" }}>
    Đang kiểm tra đăng nhập...
  </main>;
}
