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

type DeckFilter = "all" | "major" | "cups" | "pentacles" | "swords" | "wands";

function isMajor(slug: string) {
  // старшие арканы у тебя идут как "0-..." "21-..."
  return /^\d+-/.test(slug);
}

function suitOf(slug: string): DeckFilter | null {
  if (slug.includes("of-cups")) return "cups";
  if (slug.includes("of-pentacles")) return "pentacles";
  if (slug.includes("of-swords")) return "swords";
  if (slug.includes("of-wands")) return "wands";
  return null;
}

export default function DeckPage() {
  const allCards = useMemo<DeckCard[]>(
    () =>
      CARD_SLUGS
        .filter((s) => s !== "card-back") // на всякий случай
        .map((slug) => ({ slug, image: cardImage(slug) })),
    []
  );

  const [filter, setFilter] = useState<DeckFilter>("all");

  const cards = useMemo(() => {
    if (filter === "all") return allCards;
    if (filter === "major") return allCards.filter((c) => isMajor(c.slug));
    return allCards.filter((c) => suitOf(c.slug) === filter);
  }, [allCards, filter]);

  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<DeckCard | null>(null);

  function openCard(c: DeckCard) {
    setPicked(c);
    setOpen(true);
    window.Telegram?.WebApp?.HapticFeedback?.selectionChanged?.();
  }

  return (
    <AppShell>
      <RitualHeader label="Колода" />

      <div className="card">
        <div className="small">Тап по карте — откроется название и значение.</div>

        <div style={{ height: 10 }} />

        {/* ✅ фильтры одинакового размера */}
        <div className="segRow segRowEqual">
          <button className={`segBtn ${filter === "all" ? "segBtnActive" : ""}`} onClick={() => setFilter("all")}>
            Все
          </button>
          <button className={`segBtn ${filter === "major" ? "segBtnActive" : ""}`} onClick={() => setFilter("major")}>
            Арканы
          </button>
          <button className={`segBtn ${filter === "cups" ? "segBtnActive" : ""}`} onClick={() => setFilter("cups")}>
            Кубки
          </button>
          <button
            className={`segBtn ${filter === "pentacles" ? "segBtnActive" : ""}`}
            onClick={() => setFilter("pentacles")}
          >
            Пентакли
          </button>
          <button className={`segBtn ${filter === "swords" ? "segBtnActive" : ""}`} onClick={() => setFilter("swords")}>
            Мечи
          </button>
          <button className={`segBtn ${filter === "wands" ? "segBtnActive" : ""}`} onClick={() => setFilter("wands")}>
            Жезлы
          </button>
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
            type="button"
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

      <Modal open={open} title={picked ? ruTitleFromSlug(picked.slug) : "Карта"} onClose={() => setOpen(false)}>
        {!picked ? (
          <p className="text">…</p>
        ) : (
          <div className="row">
            <img className="img" src={picked.image} alt={ruTitleFromSlug(picked.slug)} loading="lazy" decoding="async" />
            <div className="col">
              <div className="title" style={{ fontSize: 16 }}>
                {ruTitleFromSlug(picked.slug)}
              </div>
              <p className="text" style={{ marginTop: 8 }}>
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
