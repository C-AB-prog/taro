"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Modal } from "@/components/Modal";
import { RitualHeader } from "@/components/RitualHeader";
import { ruTitleFromSlug } from "@/lib/ruTitles";

type SpreadKey =
  | "three_cards"
  | "celtic_cross"
  | "vokzal_dlya_dvoih"
  | "doctor_aibolit"
  | "my_health"
  | "money_tree"
  | "money_on_barrel";

type Category = "situation" | "love" | "money" | "health";

type SpreadMeta = {
  key: SpreadKey;
  title: string;
  about: string;
  cardsCount: number;
  price: number;
  cat: Category;
};

type SpreadCard = { slug: string; image: string };

type SpreadView = {
  spreadTitle: string;
  paidAmount: number;
  positions: string[];
  cards: SpreadCard[];
  interpretation: string;
};

function splitInterpretation(text: string) {
  const t = String(text || "").trim();
  if (!t) return { main: "", advice: "" };

  const idx = t.toLowerCase().lastIndexOf("совет:");
  if (idx >= 0) {
    const main = t.slice(0, idx).trim();
    const advice = t.slice(idx).replace(/^совет:\s*/i, "").trim();
    return { main, advice };
  }
  return { main: t, advice: "" };
}

function gridCols(n: number) {
  if (n <= 2) return 2;
  if (n === 3) return 3;
  if (n === 4) return 2;
  if (n === 5) return 3;
  if (n === 6) return 3;
  if (n === 9) return 3;
  if (n === 10) return 2;
  return 3;
}

function PricePill({ price }: { price: number }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 10px",
        borderRadius: 999,
        border: "1px solid rgba(176,142,66,.35)",
        background: "rgba(176,142,66,.10)",
        color: "rgba(26,22,16,.92)",
        fontWeight: 900,
        whiteSpace: "nowrap",
      }}
    >
      {price} <span style={{ fontWeight: 700, opacity: 0.85 }}>валюты</span>
    </span>
  );
}

function SpreadReveal({ view, resetToken }: { view: SpreadView; resetToken: string }) {
  const n = view.cards.length;
  const cols = gridCols(n);

  const [revealed, setRevealed] = useState<boolean[]>(() => Array(n).fill(false));

  // новый расклад: все закрыты
  useEffect(() => {
    setRevealed(Array(n).fill(false));
  }, [resetToken, n]);

  const openedCount = useMemo(() => revealed.filter(Boolean).length, [revealed]);
  const allOpen = openedCount === n;

  const { main, advice } = useMemo(() => splitInterpretation(view.interpretation), [view.interpretation]);

  const cardFrameStyle: React.CSSProperties = {
    width: "100%",
    aspectRatio: "2 / 3",
    borderRadius: 16,
    overflow: "hidden",
    background: "rgba(26,22,16,.06)",
    border: "1px solid rgba(20,16,10,.10)",
  };

  const imgStyle: React.CSSProperties = {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    display: "block",
  };

  return (
    <div>
      <div
        className="card"
        style={{
          padding: 14,
          border: "1px solid rgba(176,142,66,.22)",
          background: "rgba(255,255,255,.72)",
        }}
      >
        <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
          <div className="small" style={{ opacity: 0.92 }}>
            Открой все карты, чтобы увидеть трактовку.
          </div>
          <div className="small" style={{ opacity: 0.8 }}>
            Открыто: <b>{openedCount}</b>/<b>{n}</b>
          </div>
        </div>
      </div>

      <div style={{ height: 12 }} />

      <div
        className="deckGrid"
        style={{
          display: "grid",
          gridTemplateColumns: `repeat(${cols}, 1fr)`,
          gap: 10,
        }}
      >
        {view.cards.map((c, i) => {
          const isOpen = revealed[i];
          const titleRu = ruTitleFromSlug(c.slug);
          const pos = view.positions?.[i] ?? `Карта ${i + 1}`;

          return (
            <button
              key={`${c.slug}-${i}`}
              className="pressable"
              type="button"
              onClick={() =>
                setRevealed((prev) => {
                  const next = prev.slice();
                  next[i] = !next[i];
                  return next;
                })
              }
              style={{
                border: "1px solid rgba(20,16,10,.10)",
                background: "rgba(255,255,255,.80)",
                borderRadius: 18,
                padding: 10,
                cursor: "pointer",
                textAlign: "left",
              }}
              aria-label={pos}
            >
              <div className="small" style={{ fontWeight: 900, marginBottom: 8 }}>
                {pos}
              </div>

              {/* flip */}
              <div style={cardFrameStyle}>
                <div
                  style={{
                    width: "100%",
                    height: "100%",
                    position: "relative",
                    transformStyle: "preserve-3d",
                    transition: "transform 650ms cubic-bezier(.2,.7,.2,1)",
                    transform: isOpen ? "rotateY(180deg)" : "rotateY(0deg)",
                  }}
                >
                  {/* front */}
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      backfaceVisibility: "hidden",
                    }}
                  >
                    <img src="/cards/card-back.jpg" alt="Рубашка" loading="lazy" decoding="async" style={imgStyle} />
                    <div className="flipShine" />
                  </div>

                  {/* back */}
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      backfaceVisibility: "hidden",
                      transform: "rotateY(180deg)",
                    }}
                  >
                    <img src={c.image} alt={titleRu} loading="lazy" decoding="async" style={imgStyle} />
                  </div>
                </div>
              </div>

              <div className="small" style={{ marginTop: 8, fontWeight: 900 }}>
                {isOpen ? titleRu : "…"}
              </div>
            </button>
          );
        })}
      </div>

      <div style={{ height: 12 }} />

      {!allOpen ? (
        <div className="card" style={{ padding: 14 }}>
          <div className="title" style={{ fontSize: 16 }}>
            Трактовка скрыта
          </div>
          <div className="small" style={{ marginTop: 6, opacity: 0.9 }}>
            Открой все карты — и текст появится.
          </div>
        </div>
      ) : (
        <div className="card" style={{ padding: 14 }}>
          <div className="title" style={{ fontSize: 16 }}>
            Трактовка
          </div>
          <div className="small" style={{ marginTop: 4, opacity: 0.9 }}>
            Картина сложилась — читай спокойно и вдумчиво.
          </div>

          <p className="text" style={{ marginTop: 10, whiteSpace: "pre-wrap" }}>
            {main || view.interpretation}
          </p>

          {advice ? (
            <div className="adviceBox" style={{ marginTop: 12 }}>
              <div className="adviceTitle">Совет</div>
              <div className="adviceText">{advice}</div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

export default function SpreadsPage() {
  const spreads = useMemo<SpreadMeta[]>(
    () => [
      {
        key: "three_cards",
        title: "Три карты",
        cardsCount: 3,
        price: 125,
        cat: "situation",
        about: "Прошлое • Настоящее • Будущее — чтобы увидеть динамику ситуации и куда всё ведёт.",
      },
      {
        key: "celtic_cross",
        title: "Кельтский крест",
        cardsCount: 10,
        price: 1500,
        cat: "situation",
        about: "Глубокий универсальный расклад: причины, скрытые влияния, развитие и вероятный итог.",
      },
      {
        key: "vokzal_dlya_dvoih",
        title: "Вокзал для двоих",
        cardsCount: 2,
        price: 250,
        cat: "love",
        about: "Мысли гадающего и партнёра — что происходит между вами сейчас.",
      },
      {
        key: "money_tree",
        title: "Денежное дерево",
        cardsCount: 5,
        price: 500,
        cat: "money",
        about: "Финансы: корни прошлого → настоящее → помощники → помехи → итог.",
      },
      {
        key: "money_on_barrel",
        title: "Деньги на бочку",
        cardsCount: 5,
        price: 600,
        cat: "money",
        about: "Как ты относишься к деньгам и расходам — где утекает и что поменять.",
      },
      {
        key: "doctor_aibolit",
        title: "Доктор Айболит",
        cardsCount: 9,
        price: 900,
        cat: "health",
        about: "Комплексный взгляд на здоровье: влияния сверху и снизу, баланс состояния.",
      },
      {
        key: "my_health",
        title: "Моё здоровье",
        cardsCount: 6,
        price: 450,
        cat: "health",
        about: "Самодиагностика: что с ресурсом, что мешает восстановлению, что поможет.",
      },
    ],
    []
  );

  // фильтр: как в колоде, но без “Все”
  const [cat, setCat] = useState<Category>("situation");

  const filtered = useMemo(() => spreads.filter((s) => s.cat === cat), [spreads, cat]);

  const [loadingKey, setLoadingKey] = useState<SpreadKey | null>(null);
  const [view, setView] = useState<SpreadView | null>(null);
  const [open, setOpen] = useState(false);
  const [resetToken, setResetToken] = useState(String(Date.now()));
  const [err, setErr] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  async function buy(spreadKey: SpreadKey) {
    if (loadingKey) return;

    setErr(null);
    setLoadingKey(spreadKey);

    try {
      abortRef.current?.abort();
      const ctrl = new AbortController();
      abortRef.current = ctrl;

      const t = setTimeout(() => ctrl.abort(), 60000);

      const r = await fetch("/api/spreads/buy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        cache: "no-store",
        signal: ctrl.signal,
        body: JSON.stringify({ spreadKey }),
      });

      clearTimeout(t);

      const d = await r.json().catch(() => ({}));

      if (!r.ok) {
        if (r.status === 401) setErr("Нет сессии. Открой мини-приложение через Telegram и попробуй снова.");
        else if (r.status === 402 || d?.error === "NOT_ENOUGH_BALANCE") setErr("Недостаточно баланса. Нажми «+» сверху, чтобы пополнить.");
        else setErr("Не удалось сделать расклад. Попробуй ещё раз.");
        setLoadingKey(null);
        return;
      }

      if (!d?.ok || !d?.view) {
        setErr("Не удалось сделать расклад. Попробуй ещё раз.");
        setLoadingKey(null);
        return;
      }

      setView(d.view as SpreadView);
      setResetToken(String(Date.now()));
      setOpen(true);

      window.dispatchEvent(new Event("balance:refresh"));
      (globalThis as any)?.Telegram?.WebApp?.HapticFeedback?.notificationOccurred?.("success");
    } catch (e: any) {
      if (e?.name === "AbortError") setErr("Расклад готовится дольше обычного. Попробуй ещё раз.");
      else setErr("Ошибка сети. Попробуй ещё раз.");
    } finally {
      setLoadingKey(null);
    }
  }

  const filterBtns = useMemo(
    () =>
      [
        { k: "situation" as const, label: "Ситуация" },
        { k: "love" as const, label: "Отношения" },
        { k: "money" as const, label: "Деньги" },
        { k: "health" as const, label: "Здоровье" },
      ] as const,
    []
  );

  return (
    <AppShell>
      <RitualHeader label="Расклады" />

      {/* фильтр как в колоде (без “Все”) */}
      <div
        className="card"
        style={{
          padding: 12,
          border: "1px solid rgba(176,142,66,.18)",
          background: "rgba(255,255,255,.72)",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, 1fr)",
            gap: 8,
          }}
        >
          {filterBtns.map((b) => {
            const active = cat === b.k;
            return (
              <button
                key={b.k}
                className={`btn ${active ? "btnPrimary" : "btnGhost"}`}
                onClick={() => setCat(b.k)}
                type="button"
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 999,
                }}
              >
                {b.label}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ height: 12 }} />

      {err ? (
        <div className="card">
          <div className="small">
            <b>Ошибка:</b> {err}
          </div>
        </div>
      ) : null}

      <div style={{ height: err ? 12 : 0 }} />

      <div style={{ display: "grid", gap: 12 }}>
        {filtered.map((s) => (
          <div key={s.key} className="card" style={{ padding: 14 }}>
            <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
              <div>
                <div className="title" style={{ fontSize: 16 }}>
                  {s.title}
                </div>

                <div className="small" style={{ marginTop: 6, opacity: 0.92, display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <span style={{ fontWeight: 800 }}>{s.cardsCount} карт</span>
                  <PricePill price={s.price} />
                </div>
              </div>

              <button
                className="btn btnPrimary"
                onClick={() => buy(s.key)}
                disabled={!!loadingKey}
                style={{ padding: "10px 14px", borderRadius: 999, whiteSpace: "nowrap" }}
              >
                {loadingKey === s.key ? "Готовлю…" : "Сделать"}
              </button>
            </div>

            <p className="text" style={{ marginTop: 10 }}>
              {s.about}
            </p>
          </div>
        ))}
      </div>

      <Modal open={open} title={view ? view.spreadTitle : "Расклад"} onClose={() => setOpen(false)}>
        {!view ? <p className="text">…</p> : <SpreadReveal view={view} resetToken={resetToken} />}
      </Modal>
    </AppShell>
  );
}
