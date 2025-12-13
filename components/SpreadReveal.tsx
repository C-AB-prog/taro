"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { FlipCard } from "@/components/FlipCard";

type SpreadCard = { slug: string; image: string };

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
  const [revealed, setRevealed] = useState<boolean[]>(() => cards.map(() => false));

  useEffect(() => {
    setRevealed(cards.map(() => false));
  }, [resetToken]);

  const opened = useMemo(() => revealed.filter(Boolean).length, [revealed]);
  const nextIndex = useMemo(() => revealed.findIndex((x) => !x), [revealed]);
  const allOpened = opened === cards.length;

  function onReveal(i: number) {
    setRevealed((prev) => {
      if (prev[i]) return prev;
      const copy = [...prev];
      copy[i] = true;
      return copy;
    });
    window.Telegram?.WebApp?.HapticFeedback?.selectionChanged?.();
  }

  return (
    <div className="col">
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
        <div className="small">
          Открыто: <b>{opened}</b> / {cards.length}
        </div>
        <div className="badge" style={{ padding: "8px 12px" }}>
          {allOpened ? "Готово ✨" : "По одной"}
        </div>
      </div>

      <div className="small">
        {allOpened ? "Трактовка раскрылась." : "Открывай по очереди — так расклад читается чище."}
      </div>

      <div className="row" style={{ flexWrap: "wrap", gap: 10 }}>
        {cards.map((c, i) => {
          const isOpened = revealed[i];
          const enabled = isOpened || i === nextIndex;
          const pos = positions[i] ?? `Позиция ${i + 1}`;

          return (
            <motion.div
              key={`${c.slug}-${i}`}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18 }}
              style={{ width: 80 }}
            >
              <FlipCard
                frontSrc={c.image}
                backSrc={"/cards/card-back.jpg"}
                alt={c.slug}
                startSide="back"
                allowFlipBack={false}
                disabled={!enabled}
                width={80}
                height={130}
                onRevealed={() => onReveal(i)}
              />
              <div
                className="small"
                style={{
                  marginTop: 6,
                  textAlign: "center",
                  fontWeight: isOpened ? 900 : 700,
                  opacity: isOpened ? 0.95 : 0.6,
                }}
              >
                {pos}
              </div>
            </motion.div>
          );
        })}
      </div>

      <div className="card" style={{ padding: 12 }}>
        {!allOpened ? (
          <div className="small" style={{ opacity: 0.8 }}>
            Открой все карты, чтобы увидеть трактовку…
          </div>
        ) : (
          <pre style={{ whiteSpace: "pre-wrap", margin: 0, lineHeight: 1.45, color: "rgba(255,255,255,.92)" }}>
            {interpretation}
          </pre>
        )}
      </div>
    </div>
  );
}
