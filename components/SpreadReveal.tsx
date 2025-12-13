"use client";

import { useEffect, useMemo, useState } from "react";

export type SpreadCard = {
  slug: string;
  image: string;
};

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
    // сброс при открытии нового расклада/архивной записи
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

  return (
    <div>
      <div className="small">
        <b>Карты</b>
      </div>

      <div style={{ height: 10 }} />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 10,
        }}
      >
        {cards.map((c, i) => {
          const isOpen = opened[i];
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
              <img
                src={isOpen ? c.image : "/cards/card-back.jpg"}
                alt={safePositions[i]}
                loading="lazy"
                decoding="async"
                style={{
                  width: "100%",
                  height: 160,
                  objectFit: "cover",
                  borderRadius: 14,
                  display: "block",
                  border: "1px solid rgba(20,16,10,.10)",
                  background: "rgba(255,255,255,.8)",
                }}
              />

              <div
                className="small"
                style={{
                  marginTop: 8,
                  fontWeight: 950,
                  color: "var(--text)",
                }}
              >
                {safePositions[i]}
              </div>

              <div
                className="small"
                style={{
                  marginTop: 2,
                  opacity: 0.95,
                  color: "var(--muted)",
                }}
              >
                {isOpen ? "Открыта" : "Нажми, чтобы открыть"}
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

          <div className="small" style={{ marginTop: 10 }}>
            <b>Трактовка</b>
          </div>

          <p
            className="text"
            style={{
              marginTop: 8,
              color: "var(--text)",
              whiteSpace: "pre-wrap",
            }}
          >
            {interpretation}
          </p>
        </>
      ) : null}
    </div>
  );
}
