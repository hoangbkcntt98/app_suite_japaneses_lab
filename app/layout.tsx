import type { Metadata } from "next";
import { appPath } from "@manga/lib/paths";
import "./globals.css";

export const metadata: Metadata = {
  title: "Japanese Lab",
  description: "Japanese vocabulary, grammar, and practice.",
  icons: { icon: appPath("/logo.png") },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
