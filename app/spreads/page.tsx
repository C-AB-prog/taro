"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Modal } from "@/components/Modal";
import { motion } from "framer-motion";

type Spread = { key: string; titleRu: string; cardsCount: number; price: number };
type View = { spreadTitle: string; paidAmount: number; cards: { slug: string; image: string }[]; interpretation: string };

export default function SpreadsPage() {
  const [spreads, setSpreads] = useState<Spread[]>([]);
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View | null>(null);
  const [title, setTitle] = useState("Твоя трактовка");

  useEffect(() => {
    fetch("/api/spreads").then(r => r.json()).then(d => setSpreads(d.spreads));
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

    setTitle("Твоя трактовка");
    setView(d.view);
    setOpen(true);
  }

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
            <div className="small"><b>{view.spreadTitle}</b> • списано {view.paidAmount}</div>
            <div style={{ height: 10 }} />
            <div className="row" style={{ flexWrap: "wrap" }}>
              {view.cards.map((c) => (
                <motion.img
                  key={c.slug}
                  className="img"
                  src={c.image}
                  alt={c.slug}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.18 }}
                />
              ))}
            </div>
            <hr className="hr" />
            <pre style={{ whiteSpace: "pre-wrap", margin: 0, lineHeight: 1.45, color: "rgba(255,255,255,.9)" }}>
              {view.interpretation}
            </pre>
          </>
        )}
      </Modal>
    </AppShell>
  );
}
