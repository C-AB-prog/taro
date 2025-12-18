"use client";

import { useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { RitualHeader } from "@/components/RitualHeader";
import { ruTitleFromSlug } from "@/lib/ruTitles";
import { CARD_SLUGS, cardImage, type CardSlug } from "@/lib/deck";

type DeckCard = {
  slug: CardSlug;
  image: string;
};

type DeckFilter = "all" | "major" | "cups" | "pentacles" | "swords" | "wands";

function isMajor(slug: string) {
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
    () => CARD_SLUGS.map((slug) => ({ slug, image: cardImage(slug) })),
    []
  );

  const [filter, setFilter] = useState<DeckFilter>("all");

  const cards = useMemo(() => {
    if (filter === "all") return allCards;
    if (filter === "major") return allCards.filter((c) => isMajor(c.slug));
    return allCards.filter((c) => suitOf(c.slug) === filter);
  }, [allCards, filter]);

  return (
    <AppShell>
      <RitualHeader label="Колода" />

      <div className="card">
        <div className="small">Колода для просмотра. Карты не открываются.</div>

        <div style={{ height: 10 }} />

        <div className="segRow segRowEqual">
          <button
            className={`segBtn ${filter === "all" ? "segBtnActive" : ""}`}
            onClick={() => setFilter("all")}
            type="button"
          >
            Все
          </button>

          <button
            className={`segBtn ${filter === "major" ? "segBtnActive" : ""}`}
            onClick={() => setFilter("major")}
            type="button"
          >
            Арканы
          </button>

          <button
            className={`segBtn ${filter === "cups" ? "segBtnActive" : ""}`}
            onClick={() => setFilter("cups")}
            type="button"
          >
            Кубки
          </button>

          <button
            className={`segBtn ${filter === "pentacles" ? "segBtnActive" : ""}`}
            onClick={() => setFilter("pentacles")}
            type="button"
          >
            Пентакли
          </button>

          <button
            className={`segBtn ${filter === "swords" ? "segBtnActive" : ""}`}
            onClick={() => setFilter("swords")}
            type="button"
          >
            Мечи
          </button>

          <button
            className={`segBtn ${filter === "wands" ? "segBtnActive" : ""}`}
            onClick={() => setFilter("wands")}
            type="button"
          >
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
          <div
            key={c.slug}
            style={{
              border: "1px solid rgba(20,16,10,.10)",
              background: "rgba(255,255,255,.70)",
              borderRadius: 16,
              padding: 8,
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
                pointerEvents: "none", // чтобы вообще не ощущалось как кликабельное
                userSelect: "none",
              }}
              draggable={false}
            />
            <div
              className="small"
              style={{ marginTop: 8, fontWeight: 900, color: "var(--text)" }}
            >
              {ruTitleFromSlug(c.slug)}
            </div>
          </div>
        ))}
      </div>
    </AppShell>
  );
}
