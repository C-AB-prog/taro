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

type SpreadMeta = {
  key: SpreadKey;
  title: string;
  about: string;
  cardsCount: number;
  price: number;
};

type SpreadCard = {
  slug: string;
  image: string;
};

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

function SpreadReveal({ view, resetToken }: { view: SpreadView; resetToken: string }) {
  const n = view.cards.length;
  const cols = gridCols(n);

  const [revealed, setRevealed] = useState<boolean[]>(() => Array(n).fill(false));

  // ✅ теперь: при новом раскладе просто закрываем всё, БЕЗ авто-флипа
  useEffect(() => {
    setRevealed(Array(n).fill(false));
  }, [resetToken, n]);

  const openedCount = useMemo(() => revealed.filter(Boolean).length, [revealed]);
  const { main, advice } = useMemo(() => splitInterpretation(view.interpretation), [view.interpretation]);

  return (
    <div>
      <div className="card" style={{ marginTop: 6 }}>
        <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline" }}>
          <div className="small" style={{ opacity: 0.92 }}>
            Нажимай на карты, чтобы открыть.
          </div>
          <div className="small" style={{ opacity: 0.8 }}>
            Открыто: {openedCount}/{n}
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
                background: "rgba(255,255,255,.78)",
                borderRadius: 18,
                padding: 10,
                cursor: "pointer",
                textAlign: "left",
              }}
              aria-label={pos}
            >
              <div className="small" style={{ fontWeight: 900, marginBottom: 6 }}>
                {pos}
              </div>

              <div className="flipWrap" style={{ width: "100%" }}>
                <div
                  className="flipInner"
                  style={{
                    transform: isOpen ? "rotateY(180deg)" : "rotateY(0deg)",
                    transition: "transform 650ms cubic-bezier(.2,.7,.2,1)",
                    transformStyle: "preserve-3d",
                  }}
                >
                  <div className="flipFace" style={{ backfaceVisibility: "hidden" }}>
                    <img src="/cards/card-back.jpg" alt="Рубашка" loading="lazy" decoding="async" />
                    <div className="flipShine" />
                  </div>

                  <div
                    className="flipFace flipBack"
                    style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
                  >
                    <img src={c.image} alt={titleRu} loading="lazy" decoding="async" />
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

      <div className="card">
        <div className="title" style={{ fontSize: 16 }}>
          Трактовка
        </div>

        <div className="small" style={{ marginTop: 4 }}>
          Текст уже готов — можешь читать сразу или сначала открыть карты.
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
        about: "Прошлое • Настоящее • Будущее — простой расклад, чтобы увидеть динамику ситуации и куда всё ведёт.",
      },
      {
        key: "celtic_cross",
        title: "Кельтский крест",
        cardsCount: 10,
        price: 1500,
        about: "Глубокий универсальный расклад: причины, скрытые влияния, развитие и вероятный итог.",
      },
      {
        key: "vokzal_dlya_dvoih",
        title: "Вокзал для двоих",
        cardsCount: 2,
        price: 250,
        about: "Про отношения в паре: твои мысли и мысли партнёра — что происходит между вами сейчас.",
      },
      {
        key: "doctor_aibolit",
        title: "Доктор Айболит",
        cardsCount: 9,
        price: 900,
        about: "Комплексный взгляд на здоровье: ключевые влияния сверху и снизу, общий баланс состояния.",
      },
      {
        key: "my_health",
        title: "Моё здоровье",
        cardsCount: 6,
        price: 450,
        about: "Самодиагностика: что с ресурсом сейчас, что мешает восстановлению и что поможет улучшить самочувствие.",
      },
      {
        key: "money_tree",
        title: "Денежное дерево",
        cardsCount: 5,
        price: 500,
        about: "Финансы: корни прошлого → ствол настоящего → помощники → помехи → плоды (итог).",
      },
      {
        key: "money_on_barrel",
        title: "Деньги на бочку",
        cardsCount: 5,
        price: 600,
        about: "Отношение к деньгам и расходам: как ты тратишь, где утекает, что стоит поменять.",
      },
    ],
    []
  );

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
      if (e?.name === "AbortError") setErr("Расклад готовится дольше обычного. Попробуй ещё раз (или проверь интернет).");
      else setErr("Ошибка сети. Попробуй ещё раз.");
    } finally {
      setLoadingKey(null);
    }
  }

  return (
    <AppShell>
      <RitualHeader label="Расклады" />

      <div className="card">
        <div className="small">Выбери расклад — выпадут карты и появится трактовка. Всё сохраняется в архиве.</div>
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
        {spreads.map((s) => (
          <div key={s.key} className="card" style={{ padding: 14 }}>
            <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
              <div>
                <div className="title" style={{ fontSize: 16 }}>
                  {s.title}
                </div>
                <div className="small" style={{ marginTop: 2, opacity: 0.9 }}>
                  {s.cardsCount} карт • <b>{s.price}</b> валюты
                </div>
              </div>

              <button
                className="btn btnPrimary"
                onClick={() => buy(s.key)}
                disabled={!!loadingKey}
                style={{ padding: "10px 14px", borderRadius: 999 }}
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
