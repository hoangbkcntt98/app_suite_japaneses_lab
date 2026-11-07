"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiPath } from "@manga/lib/paths";
import styles from "./page.module.css";

type Example = { ja: string | null; vi: string | null; videoPath?: string | null };
type Card = {
  id: string;
  gameType?: GameKey;
  label: string;
  answer: string;
  kanji?: string | null;
  onYomi?: string | null;
  kunYomi?: string | null;
  reading?: string | null;
  meaningVi?: string | null;
  meaningJa?: string | null;
  videoPath?: string | null;
  tags?: string[];
  examples?: Example[];
  choices?: string[];
};
type GameKey = "words" | "kanji" | "grammar";
type ActiveGameKey = GameKey | "review";
type Game = { key: GameKey; name: string; kicker: string; icon: string; prompt: string; color: string };
type Deck = Record<GameKey, Card[]>;
type WordCount = number | "all";
type AnswerResult = "correct" | "wrong" | "timeout";
type Rating = "Hard" | "Good" | "Easy";
type RatingFilter = Rating | "all" | "unrated";
type TagOptions = Record<"words" | "kanji", string[]>;

const QUESTION_SECONDS = 20;
const games: Game[] = [
  { key: "words", name: "Word Blitz", kicker: "TỪ VỰNG", icon: "⚡", prompt: "Chọn nghĩa tiếng Nhật của từ này", color: "orange" },
  { key: "kanji", name: "Kanji Rush", kicker: "KANJI", icon: "火", prompt: "Kanji này mang nghĩa gì?", color: "green" },
  { key: "grammar", name: "Grammar Sprint", kicker: "NGỮ PHÁP", icon: "文", prompt: "Mẫu ngữ pháp này diễn tả gì?", color: "blue" },
];

function shuffled<T>(items: T[]) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const other = Math.floor(Math.random() * (index + 1));
    [result[index], result[other]] = [result[other], result[index]];
  }
  return result;
}

export default function GamesClient({ deck, tagOptions }: { deck: Deck; tagOptions: TagOptions }) {
  const [active, setActive] = useState<ActiveGameKey | null>(null);
  const [wordSetupOpen, setWordSetupOpen] = useState(false);
  const [kanjiSetupOpen, setKanjiSetupOpen] = useState(false);
  const [grammarSetupOpen, setGrammarSetupOpen] = useState(false);
  const [wordCount, setWordCount] = useState<WordCount>(10);
  const [kanjiCount, setKanjiCount] = useState<WordCount>(10);
  const [grammarCount, setGrammarCount] = useState<WordCount>(10);
  const [shuffleWords, setShuffleWords] = useState(true);
  const [shuffleKanji, setShuffleKanji] = useState(true);
  const [shuffleGrammar, setShuffleGrammar] = useState(true);
  const [roundCards, setRoundCards] = useState<Card[]>([]);
  const [step, setStep] = useState(0);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [result, setResult] = useState<AnswerResult | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(QUESTION_SECONDS);
  const [videoPath, setVideoPath] = useState<string | null>(null);
  const [timerEnabled, setTimerEnabled] = useState(true);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [reviewCount, setReviewCount] = useState(0);
  const [ratings, setRatings] = useState<Record<string, Rating>>({});
  const [ratingFilters, setRatingFilters] = useState<Record<GameKey, RatingFilter[]>>({
    words: ["all"], kanji: ["all"], grammar: ["all"],
  });
  const [tagFilters, setTagFilters] = useState<Record<"words" | "kanji", string[]>>({
    words: [], kanji: [],
  });

  const tagFilteredDeck = useCallback((key: GameKey) => deck[key].filter((item) => {
    const selectedTags = key === "words" || key === "kanji" ? tagFilters[key] : [];
    return !selectedTags.length || selectedTags.some((tag) => item.tags?.includes(tag));
  }), [deck, tagFilters]);
  const filteredDeck = useCallback((key: GameKey) => tagFilteredDeck(key).filter((item) => {
    const rating = ratings[`${key}:${item.id}`];
    const selected = ratingFilters[key];
    const ratingMatches = selected.includes("all")
      || selected.some((filter) => filter === "unrated" ? !rating : rating === filter);
    return ratingMatches;
  }),
  [ratingFilters, ratings, tagFilteredDeck]);

  const game = games.find((item) => item.key === active) || (active === "review" ? { name: "Ôn tập", key: "words" as const } : undefined);
  const cards = roundCards;
  const card = cards[step];
  const options = useMemo(() => {
    if (!card) return [];
    const type = card.gameType || (active === "review" ? null : active);
    if (!type) return [card.answer];
    const tagFiltered = (type === "words" || type === "kanji") && tagFilters[type].length > 0;
    if (!tagFiltered && card.choices?.length === 4) return card.choices;
    const answerPool = type === "words" || type === "kanji"
      ? tagFilteredDeck(type)
      : deck[type];
    const distractors = shuffled([...new Set(answerPool
      .filter((item) => item.answer !== card.answer)
      .map((item) => item.answer))])
      .slice(0, 3);
    return shuffled([card.answer, ...distractors]);
  }, [active, card, deck, tagFilteredDeck, tagFilters]);
  const wordCountOptions = useMemo(() => {
    const available = filteredDeck("words").length;
    return [...new Set([5, 10, 20, 50, 100, 200, 500].filter((count) => count < available)), "all" as const];
  }, [filteredDeck]);
  const kanjiCountOptions = useMemo(() => {
    const available = filteredDeck("kanji").length;
    return [...new Set([5, 10, 20, 50, 100, 200, 500].filter((count) => count < available)), "all" as const];
  }, [filteredDeck]);
  const grammarCountOptions = useMemo(() => {
    const available = filteredDeck("grammar").length;
    return [...new Set([5, 10, 20, 50, 100, 200, 500].filter((count) => count < available)), "all" as const];
  }, [filteredDeck]);

  useEffect(() => {
    Promise.all([
      fetch(apiPath("/api/favorites")).then((response) => response.ok ? response.json() : []),
      fetch(apiPath("/api/review")).then((response) => response.ok ? response.json() : []),
      fetch(apiPath("/api/ratings")).then((response) => response.ok ? response.json() : []),
    ]).then(([savedFavorites, savedReview, savedRatings]) => {
      setFavorites(new Set(savedFavorites));
      setReviewCount(savedReview.length);
      setRatings(Object.fromEntries(savedRatings.map((item: { type: GameKey; id: string; rating: Rating }) =>
        [`${item.type}:${item.id}`, item.rating])));
    }).catch(() => {});
  }, []);

  const rememberWrong = useCallback((item: Card) => {
    const type = item.gameType || (active === "review" ? "words" : active);
    if (!type) return;
    fetch(apiPath("/api/review"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, id: item.id, question: item }),
    }).then(async (response) => {
      if (!response.ok) return;
      const listResponse = await fetch(apiPath("/api/review"));
      if (listResponse.ok) setReviewCount((await listResponse.json()).length);
    }).catch(() => {});
  }, [active]);

  useEffect(() => {
    if (!active || !timerEnabled || !card || result) return;
    const timer = window.setTimeout(() => {
      if (secondsLeft <= 1) {
        setSecondsLeft(0);
        setResult("timeout");
        setSelected(null);
        setStreak(0);
        rememberWrong(card);
      } else {
        setSecondsLeft(secondsLeft - 1);
      }
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [active, card, result, secondsLeft, timerEnabled, rememberWrong]);

  function start(key: GameKey, count: WordCount = "all", shuffleOrder?: boolean) {
    const shouldShuffle = shuffleOrder ?? (key === "words" ? shuffleWords : key === "kanji" ? shuffleKanji : true);
    const filtered = filteredDeck(key);
    const ordered = shouldShuffle ? shuffled(filtered) : filtered;
    const selectedCards = count !== "all"
      ? ordered.slice(0, count)
      : ordered;
    setRoundCards(selectedCards.map((item) => ({ ...item, gameType: key })));
    setActive(key);
    setWordSetupOpen(false);
    setKanjiSetupOpen(false);
    setGrammarSetupOpen(false);
    setStep(0);
    setScore(0);
    setStreak(0);
    setSelected(null);
    setResult(null);
    setSecondsLeft(QUESTION_SECONDS);
    setVideoPath(null);
  }

  function rateCard(rating: Rating) {
    if (!card) return;
    const type = card.gameType || (active === "review" ? "words" : active);
    if (!type) return;
    setRatings((current) => ({ ...current, [`${type}:${card.id}`]: rating }));
    void fetch(apiPath("/api/ratings"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, id: card.id, rating }),
    }).catch(() => {});
    next();
  }

  function ratingFilterControl(key: GameKey) {
    const options: RatingFilter[] = ["all", "unrated", "Hard", "Good", "Easy"];
    return <div className={styles.ratingFilters} role="group" aria-label="Lọc theo phân loại">
      {options.map((rating) => <label
        key={rating}
          className={ratingFilters[key].includes(rating) ? styles.ratingFilterSelected : ""}
      >
        <input
          type="checkbox"
          name={`rating-filter-${key}`}
          value={rating}
          checked={ratingFilters[key].includes(rating)}
          onChange={() => setRatingFilters((current) => {
            if (rating === "all") return { ...current, [key]: ["all"] };
            const selected = current[key].filter((item) => item !== "all");
            const next = selected.includes(rating)
              ? selected.filter((item) => item !== rating)
              : [...selected, rating];
            return { ...current, [key]: next.length ? next : ["all"] };
          })}
        />
        {rating === "all" ? "Tất cả level" : rating === "unrated" ? "Unrated" : rating}
      </label>)}
    </div>;
  }

  function tagFilterControl(key: "words" | "kanji") {
    const selected = tagFilters[key];
    return <div className={styles.tagFilterSection}>
      <span className={styles.tagFilterTitle}>Tags</span>
      {tagOptions[key].length ? <div className={styles.tagFilters} role="group" aria-label="Lọc theo tags">
        <label className={!selected.length ? styles.tagFilterSelected : ""}>
          <input
            type="checkbox"
            checked={!selected.length}
            onChange={() => setTagFilters((current) => ({ ...current, [key]: [] }))}
          />
          Tất cả tags
        </label>
        {tagOptions[key].map((tag) => <label
          key={tag}
          className={selected.includes(tag) ? styles.tagFilterSelected : ""}
        >
          <input
            type="checkbox"
            checked={selected.includes(tag)}
            onChange={() => setTagFilters((current) => {
              const tags = current[key].includes(tag)
                ? current[key].filter((item) => item !== tag)
                : [...current[key], tag];
              return { ...current, [key]: tags };
            })}
          />
          {tag}
        </label>)}
      </div> : <p className={styles.noTags}>Database chưa có tags.</p>}
    </div>;
  }

  async function startReview() {
    const response = await fetch(apiPath("/api/review"));
    if (!response.ok) return;
    const items = await response.json() as { type: GameKey; id: string; question: Card }[];
    setReviewCount(items.length);
    setRoundCards(shuffled(items.map((item) => ({ ...item.question, id: item.id, gameType: item.type }))));
    setActive("review");
    setWordSetupOpen(false);
    setKanjiSetupOpen(false);
    setGrammarSetupOpen(false);
    setStep(0); setScore(0); setStreak(0); setSelected(null); setResult(null);
    setSecondsLeft(QUESTION_SECONDS); setVideoPath(null);
  }

  function chooseGame(key: GameKey) {
    if (key === "words") {
      setWordCount(deck.words.length >= 10 ? 10 : "all");
      setWordSetupOpen(true);
      return;
    }
    if (key === "kanji") {
      setKanjiCount(deck.kanji.length >= 10 ? 10 : "all");
      setKanjiSetupOpen(true);
      return;
    }
    if (key === "grammar") {
      setGrammarCount(deck.grammar.length >= 10 ? 10 : "all");
      setGrammarSetupOpen(true);
      return;
    }
    start(key);
  }

  function pick(answer: string) {
    if (!card || result) return;
    setSelected(answer);
    if (answer === card.answer) {
      setResult("correct");
      setScore((value) => value + 10);
      setStreak((value) => value + 1);
      if (active === "review" && card.gameType) {
        fetch(apiPath("/api/review"), {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: card.gameType, id: card.id }),
        }).then(() => setReviewCount((count) => Math.max(0, count - 1))).catch(() => {});
      }
    } else {
      setResult("wrong");
      setStreak(0);
      rememberWrong(card);
    }
  }

  async function toggleFavorite() {
    if (!card) return;
    const type = card.gameType || (active === "review" ? "words" : active);
    if (!type) return;
    const key = `${type}:${card.id}`;
    const isFavorite = favorites.has(key);
    const response = await fetch(apiPath("/api/favorites"), {
      method: isFavorite ? "DELETE" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, id: card.id, question: card }),
    });
    if (!response.ok) return;
    setFavorites((current) => {
      const next = new Set(current);
      if (isFavorite) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function next() {
    setStep((value) => value + 1);
    setSelected(null);
    setResult(null);
    setSecondsLeft(QUESTION_SECONDS);
    setVideoPath(null);
  }

  function exitGame() {
    setActive(null);
    setRoundCards([]);
    setResult(null);
    setSelected(null);
    setVideoPath(null);
  }

  if (!active) {
    return <>
      <section className={styles.gameGrid}>
        {games.map((item) => <button
          key={item.key}
          onClick={() => chooseGame(item.key)}
          disabled={item.key === "kanji" && deck.kanji.length === 0}
          className={`${styles.gameCard} ${styles[item.color]}`}
        >
          <span>{item.icon}</span>
          <small>{item.kicker}</small>
          <strong>{item.name}</strong>
          <p>{item.key === "words" ? `${deck.words.length} từ · chọn số lượng mỗi vòng.` : item.key === "kanji" ? `${deck.kanji.length} từ · chọn cách đọc đúng.` : `${deck.grammar.length} mẫu · chọn số lượng mỗi vòng.`}</p>
          <b>Thiết lập vòng →</b>
        </button>)}
        <button className={`${styles.gameCard} ${styles.reviewCard}`} onClick={() => void startReview()} disabled={!reviewCount}>
          <span>↻</span><small>ÔN TẬP</small><strong>Review Room</strong>
          <p>{reviewCount} câu sai · chơi lại câu cần luyện.</p><b>{reviewCount ? "Ôn tập ngay →" : "Chưa có câu sai"}</b>
        </button>
      </section>
      {wordSetupOpen ? <div className={styles.setupBackdrop}>
        <section className={styles.setupPanel} role="dialog" aria-modal="true" aria-labelledby="word-setup-title">
          <button className={styles.setupClose} aria-label="Đóng" onClick={() => setWordSetupOpen(false)}>×</button>
          <span className={styles.setupIcon}>⚡</span>
          <p className={styles.setupKicker}>WORD BLITZ</p>
          <h2 id="word-setup-title">Chọn độ dài vòng</h2>
          <p className={styles.setupDescription}>Chọn phân loại, thứ tự và số từ cho vòng chơi.</p>
          {ratingFilterControl("words")}
          {tagFilterControl("words")}
          <label className={styles.timerSetting}><span>Đếm giờ mỗi câu</span><input type="checkbox" checked={timerEnabled} onChange={(event) => setTimerEnabled(event.target.checked)} /> {timerEnabled ? "Bật" : "Tắt"}</label>
          <div className={styles.orderChoices} role="group" aria-label="Thứ tự từ vựng">
            <button
              className={shuffleWords ? styles.orderSelected : ""}
              aria-pressed={shuffleWords}
              onClick={() => setShuffleWords(true)}
            >Xáo trộn</button>
            <button
              className={!shuffleWords ? styles.orderSelected : ""}
              aria-pressed={!shuffleWords}
              onClick={() => setShuffleWords(false)}
            >Theo thứ tự database</button>
          </div>
          <div className={styles.countChoices}>
            {wordCountOptions.map((count) => {
              const value = count === "all" ? "all" : count;
              const label = count === "all" ? `Tất cả · ${filteredDeck("words").length}` : `${count} từ`;
              return <button
                key={count}
                className={wordCount === value ? styles.countSelected : ""}
                aria-pressed={wordCount === value}
                onClick={() => setWordCount(value)}
              >{label}</button>;
            })}
          </div>
          <button
            className={styles.startRound}
            disabled={!filteredDeck("words").length}
            onClick={() => start("words", wordCount, shuffleWords)}
          >Bắt đầu vòng →</button>
        </section>
      </div> : null}
      {kanjiSetupOpen ? <div className={styles.setupBackdrop}>
        <section className={styles.setupPanel} role="dialog" aria-modal="true" aria-labelledby="kanji-setup-title">
          <button className={styles.setupClose} aria-label="Đóng" onClick={() => setKanjiSetupOpen(false)}>×</button>
          <span className={styles.setupIcon}>漢</span>
          <p className={styles.setupKicker}>KANJI RUSH</p>
          <h2 id="kanji-setup-title">Thiết lập vòng</h2>
          <p className={styles.setupDescription}>Chọn phân loại, số câu và thứ tự từ vựng.</p>
          {ratingFilterControl("kanji")}
          {tagFilterControl("kanji")}
          <label className={styles.timerSetting}><span>Đếm giờ mỗi câu</span><input type="checkbox" checked={timerEnabled} onChange={(event) => setTimerEnabled(event.target.checked)} /> {timerEnabled ? "Bật" : "Tắt"}</label>
          <div className={styles.orderChoices} role="group" aria-label="Thứ tự câu hỏi">
            <button
              className={shuffleKanji ? styles.orderSelected : ""}
              aria-pressed={shuffleKanji}
              onClick={() => setShuffleKanji(true)}
            >Xáo trộn</button>
            <button
              className={!shuffleKanji ? styles.orderSelected : ""}
              aria-pressed={!shuffleKanji}
              onClick={() => setShuffleKanji(false)}
            >Theo thứ tự database</button>
          </div>
          <div className={styles.countChoices}>
            {kanjiCountOptions.map((count) => {
              const value = count === "all" ? "all" : count;
              const label = count === "all" ? `Tất cả · ${filteredDeck("kanji").length}` : `${count} câu`;
              return <button
                key={count}
                className={kanjiCount === value ? styles.countSelected : ""}
                aria-pressed={kanjiCount === value}
                onClick={() => setKanjiCount(value)}
              >{label}</button>;
            })}
          </div>
          <button
            className={styles.startRound}
            disabled={!filteredDeck("kanji").length}
            onClick={() => start("kanji", kanjiCount, shuffleKanji)}
          >Bắt đầu vòng →</button>
        </section>
      </div> : null}
      {grammarSetupOpen ? <div className={styles.setupBackdrop}>
        <section className={styles.setupPanel} role="dialog" aria-modal="true" aria-labelledby="grammar-setup-title">
          <button className={styles.setupClose} aria-label="Đóng" onClick={() => setGrammarSetupOpen(false)}>×</button>
          <span className={`${styles.setupIcon} ${styles.setupIconBlue}`}>文</span>
          <p className={styles.setupKicker}>GRAMMAR SPRINT</p>
          <h2 id="grammar-setup-title">Thiết lập vòng</h2>
          <p className={styles.setupDescription}>Chọn phân loại, thứ tự và số mẫu ngữ pháp.</p>
          {ratingFilterControl("grammar")}
          <label className={styles.timerSetting}><span>Đếm giờ mỗi câu</span><input type="checkbox" checked={timerEnabled} onChange={(event) => setTimerEnabled(event.target.checked)} /> {timerEnabled ? "Bật" : "Tắt"}</label>
          <div className={styles.orderChoices} role="group" aria-label="Thứ tự mẫu ngữ pháp">
            <button
              className={shuffleGrammar ? styles.orderSelected : ""}
              aria-pressed={shuffleGrammar}
              onClick={() => setShuffleGrammar(true)}
            >Xáo trộn</button>
            <button
              className={!shuffleGrammar ? styles.orderSelected : ""}
              aria-pressed={!shuffleGrammar}
              onClick={() => setShuffleGrammar(false)}
            >Theo thứ tự database</button>
          </div>
          <div className={styles.countChoices}>
            {grammarCountOptions.map((count) => {
              const value = count === "all" ? "all" : count;
              const label = count === "all" ? `Tất cả · ${filteredDeck("grammar").length}` : `${count} mẫu`;
              return <button
                key={count}
                className={grammarCount === value ? styles.countSelected : ""}
                aria-pressed={grammarCount === value}
                onClick={() => setGrammarCount(value)}
              >{label}</button>;
            })}
          </div>
          <button
            className={styles.startRound}
            disabled={!filteredDeck("grammar").length}
            onClick={() => start("grammar", grammarCount, shuffleGrammar)}
          >Bắt đầu vòng →</button>
        </section>
      </div> : null}
    </>;
  }

  if (!card) return <section className={styles.result}>
    <span>🏆</span><p>{game?.name}</p><h2>Hoàn thành!</h2>
    <strong>{score} XP</strong><small>Chuỗi cao nhất lượt này: {streak}</small>
    <button onClick={() => active === "review" ? void startReview() : start(
      active,
      active === "words" ? wordCount : active === "kanji" ? kanjiCount : grammarCount,
      active === "words" ? shuffleWords : active === "kanji" ? shuffleKanji : shuffleGrammar,
    )}>Chơi lại</button>
    <button className={styles.ghost} onClick={exitGame}>Chọn game khác</button>
  </section>;

  const questionType = card.gameType || (active === "review" ? "words" : active);
  const isWordGame = questionType === "words";
  const isKanjiGame = questionType === "kanji";
  const isGrammarGame = questionType === "grammar";
  const examples = (card.examples || []).filter((example) => example.ja?.trim());

  return <section className={styles.arena}>
    <div className={styles.arenaTop}>
      <button className={styles.exit} aria-label="Thoát game" onClick={exitGame}>×</button>
      <div className={styles.progress}><i style={{ width: `${((step + 1) / cards.length) * 100}%` }} /></div>
      <span>🔥 {streak}</span><b>{score} XP</b>
    </div>
    {timerEnabled ? <div className={styles.timerRow} aria-live="polite">
      <span>Thời gian</span>
      <strong className={secondsLeft <= 5 ? styles.timerUrgent : ""}>{secondsLeft}s</strong>
      <div className={styles.timerTrack}><i className={secondsLeft <= 5 ? styles.timerTrackUrgent : ""} style={{ width: `${(secondsLeft / QUESTION_SECONDS) * 100}%` }} /></div>
    </div> : null}
    <div className={styles.question}>
      <h2>{card.label}</h2><small>{step + 1} / {cards.length}</small>
    </div>
    <div className={styles.answers}>{options.map((answer, index) => {
      const state = result ? (answer === card.answer ? styles.correct : selected === answer ? styles.wrong : "") : "";
      return <button key={`${answer}-${index}`} className={state} disabled={Boolean(result)} onClick={() => pick(answer)}>
        <i>{String.fromCharCode(65 + index)}</i>{answer}
      </button>;
    })}</div>
    {result && (isWordGame || isKanjiGame || isGrammarGame) ? <div className={styles.answerBackdrop}>
      <article className={styles.answerModal} role="dialog" aria-modal="true" aria-labelledby="answer-detail-title">
        <div className={`${styles.answerBanner} ${result === "correct" ? styles.answerBannerGood : ""}`}>
          <span>{result === "correct" ? "ĐÚNG RỒI · +10 XP" : result === "timeout" ? "HẾT GIỜ · ĐÁP ÁN" : "ĐÁP ÁN"}</span>
          <div className={styles.answerActions}>
            <button className={`${styles.favoriteButton} ${favorites.has(`${questionType}:${card.id}`) ? styles.favoriteActive : ""}`} aria-label={favorites.has(`${questionType}:${card.id}`) ? "Bỏ yêu thích" : "Thêm yêu thích"} onClick={() => void toggleFavorite()}>{favorites.has(`${questionType}:${card.id}`) ? "♥" : "♡"}</button>
            <button aria-label="Tiếp tục" onClick={next}>×</button>
          </div>
        </div>
        <div className={styles.answerWord}>
          <h2 id="answer-detail-title">{isKanjiGame ? card.kanji || card.label : card.label}</h2>
          <span>{isKanjiGame ? card.label : isGrammarGame ? "Mẫu ngữ pháp" : card.reading}</span>
        </div>
        {isKanjiGame ? <>
          {card.meaningVi ? <p className={styles.wordMeaning}>{card.meaningVi}</p> : null}
          <div className={styles.kanjiReadings}>
            <p><b>Âm On</b><span>{card.onYomi || "—"}</span></p>
            <p><b>Âm Kun</b><span>{card.kunYomi || "—"}</span></p>
          </div>
        </> : isGrammarGame ? <>
          <p className={styles.grammarMeaningJa}><b>日本語</b>{card.meaningJa || "—"}</p>
          <p className={styles.wordMeaning}><b>Tiếng Việt</b>{card.meaningVi || card.answer}</p>
        </> : <>
          <p className={styles.wordMeaning}>{card.answer}</p>
          {card.meaningVi ? <p className={styles.wordMeaningVi}>{card.meaningVi}</p> : null}
        </>}
        <div className={styles.exampleList}>
          <h3>{isKanjiGame ? `Ví dụ (${examples.length})` : isGrammarGame ? `Câu ví dụ (${examples.length})` : "Ví dụ"}</h3>
          {examples.length ? examples.map((example, index) => <div key={`${example.ja}-${index}`}>
            <p>{example.ja}</p>{example.vi ? <small>{example.vi}</small> : null}
            {isGrammarGame && example.videoPath ? <button
              className={styles.videoButton}
              onClick={() => setVideoPath(example.videoPath || null)}
            >Xem video</button> : null}
          </div>) : <p className={styles.noExamples}>Chưa có câu ví dụ.</p>}
        </div>
        <div className={styles.classification}>
          <span>Phân loại từ này</span>
          <div>{(["Hard", "Good", "Easy"] as Rating[]).map((rating) => (
            <button
              key={rating}
              className={`${styles[rating.toLowerCase()]} ${ratings[`${questionType}:${card.id}`] === rating ? styles.ratingActive : ""}`}
              aria-pressed={ratings[`${questionType}:${card.id}`] === rating}
              onClick={() => rateCard(rating)}
            >{rating}</button>
          ))}</div>
        </div>
        {isGrammarGame && card.videoPath ? <button
          className={styles.patternVideoButton}
          onClick={() => setVideoPath(card.videoPath || null)}
        >Xem video mẫu ngữ pháp</button> : null}
        <button className={styles.nextWord} onClick={next}>{isKanjiGame ? "Tiếp tục →" : "Câu tiếp theo →"}</button>
      </article>
    </div> : null}
    {videoPath ? <div className={styles.videoBackdrop} role="dialog" aria-modal="true" aria-label="Video ví dụ">
      <div className={styles.videoModal}>
        <button className={styles.videoClose} aria-label="Đóng video" onClick={() => setVideoPath(null)}>×</button>
        <video controls autoPlay playsInline src={apiPath(`/api/video?path=${encodeURIComponent(videoPath)}`)} />
      </div>
    </div> : null}
  </section>;
}
