"use client";

import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Modal } from "@/components/Modal";
import { motion } from "framer-motion";
import { SpreadReveal } from "@/components/SpreadReveal";

type Spread = { key: string; titleRu: string; cardsCount: number; price: number };
type View = {
  spreadTitle: string;
  paidAmount: number;
  cards: { slug: string; image: string }[];
  interpretation: string;
};

export default function SpreadsPage() {
  const [spreads, setSpreads] = useState<Spread[]>([]);
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View | null>(null);
  const [title, setTitle] = useState("Твоя трактовка");

  useEffect(() => {
    fetch("/api/spreads").then((r) => r.json()).then((d) => setSpreads(d.spreads));
  }, []);

  async function buy(spreadKey: string) {
    const r = await fetch("/api/spreads/buy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ spreadKey }),
    });

    const d = await r.json();
    if (!r.ok) {
      setTitle(d.error === "NOT_ENOUGH_BALANCE" ? "Не хватает баланса" : "Ошибка");
      setView(null);
      setOpen(true);
      return;
    }

    setTitle("Расклад готов");
    setView(d.view);
    setOpen(true);
  }

  const resetToken = useMemo(() => {
    if (!view) return "none";
    return `${view.spreadTitle}|${view.paidAmount}|${view.cards.map((c) => c.slug).join(",")}`;
  }, [view]);

  return (
    <AppShell title="Расклады">
      <h1 className="h1">Расклады</h1>

      {spreads.map((s, i) => (
        <motion.div
          key={s.key}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: i * 0.03 }}
          className="card"
          style={{ marginBottom: 12 }}
        >
          <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div className="title">{s.titleRu}</div>
              <div className="small">{s.cardsCount} карт • цена <b>{s.price}</b></div>
            </div>
            <button className="btn btnPrimary" onClick={() => buy(s.key)}>Купить</button>
          </div>
        </motion.div>
      ))}

      <Modal open={open} title={title} onClose={() => setOpen(false)}>
        {!view ? (
          <p className="text">Ок.</p>
        ) : (
          <>
            <div className="small">
              <b>{view.spreadTitle}</b> • списано {view.paidAmount}
            </div>
            <div style={{ height: 10 }} />
           <SpreadReveal
  cards={view.cards}
  positions={view.positions ?? view.cards.map((_, i) => `Позиция ${i + 1}`)}
  interpretation={view.interpretation}
  resetToken={resetToken}
/>

          </>
        )}
      </Modal>
    </AppShell>
  );
}
