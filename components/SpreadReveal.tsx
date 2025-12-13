"use client";

import { useEffect, useMemo, useState } from "react";
import { ruTitleFromSlug } from "@/lib/ruTitles";

export type SpreadCard = {
  slug: string;
  image: string;
};

function splitAdvice(text: string): { body: string; advice: string } {
  const t = (text ?? "").trim();
  if (!t) return { body: "", advice: "" };

  const re = /(?:^|\n)\s*(совет|рекомендация)\s*[:—-]\s*/i;
  const m = re.exec(t);
  if (m && m.index >= 0) {
    const before = t.slice(0, m.index).trim();
    const after = t.slice(m.index).replace(re, "").trim();
    return { body: before, advice: after };
  }

  const parts = t.split(/\n\s*\n/g).map((p) => p.trim()).filter(Boolean);
  if (parts.length <= 1) return { body: "", advice: t };
  return { body: parts.slice(0, -1).join("\n\n"), advice: parts[parts.length - 1] };
}

export function SpreadReveal({
  cards,
  positions,
  interpretation,
  resetToken,
}: {
  cards: SpreadCard[];
  positions: string[];
  interpretation: string;
  resetToken: string;
}) {
  const safePositions = useMemo(() => {
    return cards.map((_, i) => positions?.[i] ?? `Позиция ${i + 1}`);
  }, [cards, positions]);

  const [opened, setOpened] = useState<boolean[]>(() => cards.map(() => false));

  useEffect(() => {
    setOpened(cards.map(() => false));
  }, [resetToken, cards.length]);

  const allOpened = opened.length === cards.length && opened.every(Boolean);

  function openOne(i: number) {
    setOpened((prev) => {
      if (prev[i]) return prev;
      const next = prev.slice();
      next[i] = true;
      return next;
    });
    window.Telegram?.WebApp?.HapticFeedback?.selectionChanged?.();
  }

  function openAll() {
    setOpened(cards.map(() => true));
    window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred?.("success");
  }

  const { body, advice } = useMemo(() => splitAdvice(interpretation), [interpretation]);

  return (
    <div>
      <div className="small"><b>Карты</b></div>
      <div style={{ height: 10 }} />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
        {cards.map((c, i) => {
          const isOpen = opened[i];
          const cardTitle = ruTitleFromSlug(c.slug);

          return (
            <button
              key={`${c.slug}-${i}`}
              className="pressable"
              onClick={() => openOne(i)}
              style={{
                border: "1px solid rgba(20,16,10,.10)",
                background: "rgba(255,255,255,.72)",
                borderRadius: 16,
                padding: 8,
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              <div style={{ width: "100%", height: 160, perspective: 900, position: "relative" }}>
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    borderRadius: 14,
                    transformStyle: "preserve-3d",
                    transform: isOpen ? "rotateY(180deg)" : "rotateY(0deg)",
                    transition: "transform 650ms cubic-bezier(.2,.7,.2,1)",
                  }}
                >
                  <div className="flipFace" style={{ borderRadius: 14 }}>
                    <img
                      src="/cards/card-back.jpg"
                      alt="Рубашка"
                      loading="lazy"
                      decoding="async"
                      style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                    />
                    <div className="flipShine" />
                  </div>

                  <div className="flipFace flipBack" style={{ borderRadius: 14 }}>
                    <img
                      src={c.image}
                      alt={cardTitle}
                      loading="lazy"
                      decoding="async"
                      style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                    />
                  </div>
                </div>
              </div>

              <div className="small" style={{ marginTop: 8, fontWeight: 950, color: "var(--text)" }}>
                {isOpen ? cardTitle : "Нажми, чтобы открыть"}
              </div>

              <div className="small" style={{ marginTop: 2, color: "var(--muted)" }}>
                {safePositions[i]}
              </div>
            </button>
          );
        })}
      </div>

      <div style={{ height: 12 }} />

      {!allOpened ? (
        <button className="btn btnGhost" style={{ width: "100%" }} onClick={openAll}>
          Открыть все карты
        </button>
      ) : null}

      {allOpened ? (
        <>
          <div style={{ height: 12 }} />
          <div className="hr" />

          {body ? (
            <>
              <div className="small" style={{ marginTop: 10 }}><b>Трактовка</b></div>
              <p className="text" style={{ marginTop: 8, whiteSpace: "pre-wrap" }}>{body}</p>
            </>
          ) : null}

          {advice ? (
            <div className="adviceBox" style={{ marginTop: 12 }}>
              <div className="adviceTitle">Совет</div>
              <div className="adviceText" style={{ whiteSpace: "pre-wrap" }}>{advice}</div>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
