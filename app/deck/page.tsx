"use client";

import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Modal } from "@/components/Modal";
import { motion } from "framer-motion";

type CardListItem = { slug: string; titleRu: string; image: string };
type CardMeaning = { slug: string; titleRu: string; meaningRu: string; image: string };

type FilterKey = "all" | "major" | "wands" | "cups" | "swords" | "pentacles";

function hapticSelect() {
  const h = window.Telegram?.WebApp?.HapticFeedback;
  h?.selectionChanged?.();
}

function groupFromSlug(slug: string): FilterKey {
  // Старшие арканы: начинаются с "0-" ... "21-"
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

export default function DeckPage() {
  const [cards, setCards] = useState<CardListItem[]>([]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");

  const [open, setOpen] = useState(false);
  const [card, setCard] = useState<CardMeaning | null>(null);
  const [loading, setLoading] = useState(true);

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
    const q = query.trim().toLowerCase();

    return cards.filter((c) => {
      const g = groupFromSlug(c.slug);

      const byFilter =
        filter === "all"
          ? true
          : g === filter;

      const byQuery = !q ? true : (c.titleRu || c.slug).toLowerCase().includes(q);

      return byFilter && byQuery;
    });
  }, [cards, query, filter]);

  async function openCard(slug: string) {
    const r = await fetch(`/api/cards/${slug}`, { cache: "no-store" });
    const d = await r.json();
    setCard(d.card);
    setOpen(true);
  }

  return (
    <AppShell title="Колода">
      <h1 className="h1">Колода</h1>

      <div className="card">
        <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div className="title">Фильтры</div>
            <div className="small">Выбери масть или старшие арканы</div>
          </div>
          <div className="badge" style={{ padding: "8px 12px" }}>
            {filtered.length} / {cards.length}
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

        <div style={{ height: 12 }} />

        <div className="title">Поиск</div>
        <div style={{ height: 8 }} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Например: fool, magician, cups…"
          style={{
            width: "100%",
            padding: "12px 12px",
            borderRadius: 14,
            border: "1px solid rgba(255,255,255,.14)",
            outline: "none",
            background: "rgba(0,0,0,.22)",
            color: "rgba(255,255,255,.92)",
            fontWeight: 800,
          }}
        />
      </div>

      <div style={{ height: 12 }} />

      {loading ? (
        <div className="grid">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="card" style={{ padding: 8 }}>
              <div className="shimmer" style={{ width: "100%", height: 160, borderRadius: 14 }} />
              <div style={{ height: 8 }} />
              <div className="shimmer" style={{ height: 12, width: "70%" }} />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid">
          {filtered.map((c, i) => (
            <motion.button
              key={c.slug}
              className="card"
              style={{ padding: 8, textAlign: "left", cursor: "pointer" }}
              whileTap={{ scale: 0.98 }}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.22, delay: Math.min(i, 18) * 0.02 }}
              onClick={() => openCard(c.slug)}
            >
              <motion.img
                className="img"
                src={c.image}
                alt={c.titleRu}
                loading="lazy"
                style={{ width: "100%", height: 160 }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.2 }}
              />
              <div className="small" style={{ marginTop: 8, fontWeight: 950 }}>
                {c.titleRu}
              </div>
            </motion.button>
          ))}
        </div>
      )}

      <Modal open={open} title={card?.titleRu ?? "Карта"} onClose={() => setOpen(false)}>
        {!card ? (
          <p className="text">…</p>
        ) : (
          <div className="row">
            <motion.img
              className="img"
              src={card.image}
              alt={card.titleRu}
              loading="lazy"
              initial={{ opacity: 0, rotateY: 25, y: 6 }}
              animate={{ opacity: 1, rotateY: 0, y: 0 }}
              transition={{ duration: 0.25 }}
            />
            <div className="col">
              <div className="small">Что означает</div>
              <p className="text" style={{ marginTop: 6 }}>{card.meaningRu}</p>
              <div className="small" style={{ marginTop: 8 }}>
                Подсказка: смотри на ощущения — они часто точнее слов.
              </div>
            </div>
          </div>
        )}
      </Modal>
    </AppShell>
  );
}
