import Link from "next/link";
import { pool } from "@manga/lib/db";
import DashboardMenu from "./DashboardMenu";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function loadJapaneseData() {
  const [counts, ratings] = await Promise.all([
    pool.query<{ grammar: string; words: string; kanji: string }>(`
      SELECT
        (SELECT count(*) FROM grammar_patterns WHERE deleted_at IS NULL)::text AS grammar,
        (SELECT count(*) FROM anki_word)::text AS words,
        (SELECT count(*) FROM anki_kanji)::text AS kanji`),
    pool.query<{ game_type: string; rating: string; count: string }>(`
      SELECT game_type, rating, count(*)::text AS count
      FROM japanese_game_ratings
      GROUP BY game_type, rating`),
  ]);
  return { counts: counts.rows[0], ratings: ratings.rows };
}

export default async function JapanesePage() {
  let data: Awaited<ReturnType<typeof loadJapaneseData>> | null = null;
  try { data = await loadJapaneseData(); } catch { /* shown below */ }

  if (!data) {
    return <main className={styles.page}><p className={styles.error}>Chưa thể đọc dữ liệu học tiếng Nhật. Hãy kiểm tra kết nối PostgreSQL.</p></main>;
  }

  const learned = {
    words: { Hard: 0, Good: 0, Easy: 0 },
    kanji: { Hard: 0, Good: 0, Easy: 0 },
    grammar: { Hard: 0, Good: 0, Easy: 0 },
  };
  for (const row of data.ratings) {
    if (row.game_type in learned && row.rating in learned.words) {
      learned[row.game_type as keyof typeof learned][row.rating as keyof typeof learned.words] = Number(row.count);
    }
  }
  const games = [
    { key: "words", label: "Từ vựng", icon: "語" },
    { key: "kanji", label: "Kanji", icon: "漢" },
    { key: "grammar", label: "Mẫu ngữ pháp", icon: "文" },
  ] as const;

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link href="/" className={styles.back}>← Northstar</Link>
        <div className={styles.headerActions}>
          <span className={styles.today}>{new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "short" }).format(new Date())}</span>
          <Link href="/garden" className={styles.gameLink}>🌱 Khu vườn</Link>
          <Link href="/games" className={styles.gameLink}>🎮 Chơi game</Link>
          <span className={styles.badge}>日本語 · DAILY LAB</span>
          <DashboardMenu />
        </div>
      </header>

      <section className={styles.stats} aria-label="Kho dữ liệu học tập">
        <article><strong>{data.counts.grammar}</strong><span>MẪU NGỮ PHÁP</span></article>
        <article><strong>{data.counts.kanji}</strong><span>KANJI</span></article>
        <article><strong>{data.counts.words}</strong><span>TỪ VỰNG</span></article>
      </section>

      <section className={styles.learningChart} aria-labelledby="learning-chart-title">
        <div className={styles.chartHeader}>
          <div><span className={styles.chartKicker}>TIẾN ĐỘ HỌC</span></div>
        </div>
        <div className={styles.legend} aria-label="Level">
          <span><i className={styles.hardSegment} />Hard</span>
          <span><i className={styles.goodSegment} />Good</span>
          <span><i className={styles.easySegment} />Easy</span>
        </div>
        <div className={styles.pieGrid}>
          {games.map(({ key, label, icon }) => {
            const counts = learned[key];
            const total = counts.Hard + counts.Good + counts.Easy;
            const hardEnd = total ? (counts.Hard / total) * 360 : 0;
            const goodEnd = total ? hardEnd + (counts.Good / total) * 360 : 0;
            const pie = total
              ? `conic-gradient(#e99376 0deg ${hardEnd}deg, #77bd70 ${hardEnd}deg ${goodEnd}deg, #78a8d3 ${goodEnd}deg 360deg)`
              : "conic-gradient(#eff3ed 0deg 360deg)";
            return <article className={styles.pieCard} key={key}>
              <div className={styles.pieTitle}><span>{icon}</span><strong>{label}</strong></div>
              <div
                className={styles.pieChart}
                role="img"
                aria-label={`${label}: Hard ${counts.Hard}, Good ${counts.Good}, Easy ${counts.Easy}`}
                style={{ background: pie }}
              >
                <div><strong>{total}</strong><span>đã học</span></div>
              </div>
              <div className={styles.pieValues}>
                <span><i className={styles.hardSegment} />Hard <b>{counts.Hard}</b></span>
                <span><i className={styles.goodSegment} />Good <b>{counts.Good}</b></span>
                <span><i className={styles.easySegment} />Easy <b>{counts.Easy}</b></span>
              </div>
            </article>;
          })}
        </div>
      </section>
    </main>
  );
}
