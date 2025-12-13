"use client";

import { useEffect, useState } from "react";
import { TgAuthGate } from "@/components/TgAuthGate";
import { BottomNav } from "@/components/BottomNav";
import { Modal } from "@/components/Modal";

type CardListItem = { slug: string; titleRu: string; image: string };
type CardMeaning = { slug: string; titleRu: string; meaningRu: string; image: string };

export default function DeckPage() {
  const [cards, setCards] = useState<CardListItem[]>([]);
  const [open, setOpen] = useState(false);
  const [card, setCard] = useState<CardMeaning | null>(null);

  useEffect(() => {
    fetch("/api/cards").then(r => r.json()).then(d => setCards(d.cards));
  }, []);

  async function openCard(slug: string) {
    const r = await fetch(`/api/cards/${slug}`);
    const d = await r.json();
    setCard(d.card);
    setOpen(true);
  }

  return (
    <TgAuthGate>
      <h1 className="h1">Колода</h1>

      <div className="grid">
        {cards.map((c) => (
          <button key={c.slug} className="card" style={{ padding: 8 }} onClick={() => openCard(c.slug)}>
            <img className="img" src={c.image} alt={c.titleRu} style={{ width: "100%", height: 160 }} />
            <div className="small" style={{ marginTop: 6, fontWeight: 800 }}>{c.titleRu}</div>
          </button>
        ))}
      </div>

      <Modal open={open} title={card?.titleRu ?? "Карта"} onClose={() => setOpen(false)}>
        {card && (
          <div className="row">
            <img className="img" src={card.image} alt={card.titleRu} />
            <p className="text">{card.meaningRu}</p>
          </div>
        )}
      </Modal>

      <BottomNav />
    </TgAuthGate>
  );
}
