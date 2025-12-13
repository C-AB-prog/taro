"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Modal } from "@/components/Modal";
import { RitualHeader } from "@/components/RitualHeader";
import { ruTitleFromSlug } from "@/lib/ruTitles";

type CardListItem = { slug: string; titleRu: string; image: string };
type CardMeaning = { slug: string; titleRu: string; meaningRu: string; image: string };

type FilterKey = "all" | "major" | "wands" | "cups" | "swords" | "pentacles";

function hapticSelect() {
  window.Telegram?.WebApp?.HapticFeedback?.selectionChanged?.();
}

function groupFromSlug(slug: string): FilterKey {
  if (/^\d{1,2}-/.test(slug)) return "major";
  if (slug.includes("-of-wands-")) return "wands";
  if (slug.includes("-of-cups-")) return "cups";
  if (slug.includes("-of-swords-")) return "swords";
  if (slug.includes("-of-pentacles-")) return "pentacles";
  return "all";
}

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "Все" },
  { key: "major", label: "Старшие" },
  { key: "wands", label: "Жезлы" },
  { key: "cups", label: "Кубки" },
  { key: "swords", label: "Мечи" },
  { key: "pentacles", label: "Пентакли" },
];

const PAGE = 24;

export default function DeckPage() {
  const [cards, setCards] = useState<CardListItem[]>([]);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [visible, setVisible] = useState(PAGE);

  const [open, setOpen] = useState(false);
  const [card, setCard] = useState<CardMeaning | null>(null);
  const [loading, setLoading] = useState(true);

  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const r = await fetch("/api/cards", { cache: "no-store" });
        const d = await r.json();
        setCards(d.cards || []);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  useEffect(() => {
    setVisible(PAGE);
  }, [filter]);

  const counts = useMemo(() => {
    const c: Record<FilterKey, number> = {
      all: cards.length,
      major: 0,
      wands: 0,
      cups: 0,
      swords: 0,
      pentacles: 0,
    };
    for (const x of cards) {
      const g = groupFromSlug(x.slug);
      if (g !== "all") c[g] += 1;
    }
    return c;
  }, [cards]);

  const filtered = useMemo(() => {
    return cards.filter((c) => {
      const g = groupFromSlug(c.slug);
      return filter === "all" ? true : g === filter;
    });
  }, [cards, filter]);

  const shown = useMemo(() => filtered.slice(0, visible), [filtered, visible]);
  const canMore = shown.length < filtered.length;

  useEffect(() => {
    if (!canMore) return;
    const el = sentinelRef.current;
    if (!el) return;

    const io = new IntersectionObserver(
      (entries) => {
        const e = entries[0];
        if (e.isIntersecting) setVisible((v) => Math.min(v + PAGE, filtered.length));
      },
      { rootMargin: "250px" }
    );

    io.observe(el);
    return () => io.disconnect();
  }, [canMore, filtered.length]);

  async function openCard(slug: string) {
    const r = await fetch(`/api/cards/${slug}`, { cache: "no-store" });
    const d = await r.json();
    const c = d.card as CardMeaning;
    setCard({ ...c, titleRu: ruTitleFromSlug(slug) });
    setOpen(true);
  }

  return (
    <AppShell title="Колода">
      <h1 className="h1">Колода</h1>
      <RitualHeader label="Выбери карту" />

      <div className="card">
        <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div className="title">Фильтры</div>
            <div className="small">Масти и старшие арканы</div>
          </div>
          <div className="badge" style={{ padding: "8px 12px" }}>
            {shown.length} / {filtered.length}
          </div>
        </div>

        <div style={{ height: 10 }} />

        <div className="segRow">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              className={`segBtn ${filter === f.key ? "segBtnActive" : ""}`}
              onClick={() => {
                if (filter !== f.key) hapticSelect();
                setFilter(f.key);
              }}
            >
              {f.label}
              {f.key !== "all" ? ` • ${counts[f.key]}` : ""}
            </button>
          ))}
        </div>
      </div>

      <div style={{ height: 12 }} />

      {loading ? (
        <div className="grid">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="card deckCard" style={{ padding: 8 }}>
              <div className="shimmer" style={{ width: "100%", height: 160, borderRadius: 14 }} />
              <div style={{ height: 8 }} />
              <div className="shimmer" style={{ height: 12, width: "70%" }} />
            </div>
          ))}
        </div>
      ) : (
        <>
          <div className="grid">
            {shown.map((c) => {
              const title = ruTitleFromSlug(c.slug);
              return (
                <button
                  key={c.slug}
                  className="card pressable deckCard"
                  style={{ padding: 8, textAlign: "left", cursor: "pointer" }}
                  onClick={() => openCard(c.slug)}
                >
                  <img
                    className="img"
                    src={c.image}
                    alt={title}
                    loading="lazy"
                    decoding="async"
                    style={{ width: "100%", height: 160 }}
                  />
                  <div className="small" style={{ marginTop: 8, fontWeight: 950 }}>
                    {title}
                  </div>
                </button>
              );
            })}
          </div>

          <div ref={sentinelRef} style={{ height: 1 }} />

          {canMore ? (
            <div style={{ marginTop: 12 }}>
              <button
                className="btn btnGhost"
                style={{ width: "100%" }}
                onClick={() => setVisible((v) => Math.min(v + PAGE, filtered.length))}
              >
                Показать ещё
              </button>
            </div>
          ) : null}
        </>
      )}

      <Modal open={open} title={card?.titleRu ?? "Карта"} onClose={() => setOpen(false)}>
        {!card ? (
          <p className="text">…</p>
        ) : (
          <div className="row">
            <img className="img" src={card.image} alt={card.titleRu} loading="lazy" decoding="async" />
            <div className="col">
              <div className="small">Что означает</div>
              <p className="text" style={{ marginTop: 6 }}>{card.meaningRu}</p>
            </div>
          </div>
        )}
      </Modal>
    </AppShell>
  );
}
