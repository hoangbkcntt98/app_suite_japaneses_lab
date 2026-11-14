import Link from "next/link";
import GardenClient from "./GardenClient";
import styles from "../games/page.module.css";

export default function GardenPage() {
  return <main className={styles.page}>
    <header className={styles.header}>
      <Link href="/" className={styles.back}>← Japanese Lab</Link>
      <div className={styles.headerActions}>
        <Link href="/games" className={styles.gameLink}>🎮 Chơi game</Link>
        <span className={styles.badge}>GARDEN · 育てる</span>
      </div>
    </header>
    <GardenClient />
  </main>;
}
