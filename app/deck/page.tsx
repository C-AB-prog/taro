"use client";

import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Modal } from "@/components/Modal";
import { motion } from "framer-motion";

type CardListItem = { slug: string; titleRu: string; image: string };
type CardMeaning = { slug: string; titleRu: string; meaningRu: string; image: string };

export default function DeckPage() {
  const [cards, setCards] = useState<CardListItem[]>([]);
  const [query, setQuery] = useState("");
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

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return cards;
    return cards.filter((c) => (c.titleRu || c.slug).toLowerCase().includes(q));
  }, [cards, query]);

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
            <div className="title">Поиск</div>
            <div className="small">Найди карту по названию</div>
          </div>
          <div className="badge" style={{ padding: "8px 12px" }}>
            {filtered.length} карт
          </div>
        </div>

        <div style={{ height: 10 }} />

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
              initial={{ opacity: 0, rotateY: 25, y: 6 }}
              animate={{ opacity: 1, rotateY: 0, y: 0 }}
              transition={{ duration: 0.25 }}
            />
            <div className="col">
              <div className="small">Что означает</div>
              <p className="text" style={{ marginTop: 6 }}>{card.meaningRu}</p>
              <div className="small" style={{ marginTop: 6 }}>
                Подсказка: смотри на ощущения — они часто точнее слов.
              </div>
            </div>
          </div>
        )}
      </Modal>
    </AppShell>
  );
}
