"use client";

import { useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Modal } from "@/components/Modal";
import { RitualHeader } from "@/components/RitualHeader";
import { ruTitleFromSlug } from "@/lib/ruTitles";
import { CARD_SLUGS, cardImage } from "@/lib/deck";

type DeckCard = {
  slug: string;
  image: string;
};

export default function DeckPage() {
  const cards = useMemo<DeckCard[]>(
    () => CARD_SLUGS.map((slug) => ({ slug, image: cardImage(slug) })),
    []
  );

  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<DeckCard | null>(null);

  function openCard(c: DeckCard) {
    setPicked(c);
    setOpen(true);
    window.Telegram?.WebApp?.HapticFeedback?.selectionChanged?.();
  }

  return (
    <AppShell>
      <h1 className="h1">Колода</h1>
      <RitualHeader label="Выбери карту" />

      <div className="card">
        <div className="small">
          Тап по карте — откроется название и значение.
        </div>
      </div>

      <div style={{ height: 12 }} />

      <div
        className="deckGrid"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 10,
        }}
      >
        {cards.map((c) => (
          <button
            key={c.slug}
            className="pressable"
            onClick={() => openCard(c)}
            style={{
              border: "1px solid rgba(20,16,10,.10)",
              background: "rgba(255,255,255,.70)",
              borderRadius: 16,
              padding: 8,
              cursor: "pointer",
            }}
            aria-label={ruTitleFromSlug(c.slug)}
          >
            <img
              src={c.image}
              alt={ruTitleFromSlug(c.slug)}
              loading="lazy"
              decoding="async"
              style={{
                width: "100%",
                height: 170,
                objectFit: "cover",
                borderRadius: 14,
                display: "block",
              }}
            />
            <div className="small" style={{ marginTop: 8, fontWeight: 900, color: "var(--text)" }}>
              {ruTitleFromSlug(c.slug)}
            </div>
          </button>
        ))}
      </div>

      <Modal
        open={open}
        title={picked ? ruTitleFromSlug(picked.slug) : "Карта"}
        onClose={() => setOpen(false)}
      >
        {!picked ? (
          <p className="text">…</p>
        ) : (
          <div className="row">
            <img className="img" src={picked.image} alt={ruTitleFromSlug(picked.slug)} loading="lazy" decoding="async" />
            <div className="col">
              <div className="title" style={{ fontSize: 16 }}>
                {ruTitleFromSlug(picked.slug)}
              </div>

              {/* Значение: берём из твоей мапы ruTitles/значений если есть,
                  иначе показываем аккуратную заглушку. */}
              <p className="text" style={{ marginTop: 8 }}>
                {/* Если у тебя есть функция/мапа значения — подставь сюда.
                    Сейчас оставляю нейтрально, чтобы сборка не ломалась. */}
                Эта карта говорит через образы. Если хочешь — добавим короткое “значение”
                для каждой карты в отдельном словаре.
              </p>
            </div>
          </div>
        )}
      </Modal>
    </AppShell>
  );
}
