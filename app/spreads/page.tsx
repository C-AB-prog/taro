"use client";

import { useEffect, useState } from "react";
import { TgAuthGate } from "@/components/TgAuthGate";
import { BottomNav } from "@/components/BottomNav";
import { Modal } from "@/components/Modal";

type Spread = { key: string; titleRu: string; cardsCount: number; price: number };
type PurchaseView = { spreadTitle: string; paidAmount: number; cards: { slug: string; image: string }[]; interpretation: string };

export default function SpreadsPage() {
  const [spreads, setSpreads] = useState<Spread[]>([]);
  const [modal, setModal] = useState<{ open: boolean; title: string; body?: PurchaseView }>({ open: false, title: "" });

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
      setModal({ open: true, title: d.error === "NOT_ENOUGH_BALANCE" ? "Не хватает баланса" : "Ошибка покупки" });
      return;
    }

    setModal({
      open: true,
      title: "Твоя трактовка",
      body: d.view,
    });
  }

  async function topup(tgStars: number) {
    const r = await fetch("/api/topup/mock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tgStars }),
    });
    const d = await r.json();
    setModal({ open: true, title: "Баланс пополнен", body: undefined });
  }

  return (
    <TgAuthGate>
      <h1 className="h1">Расклады</h1>

      <div className="card">
        <div className="title">Пополнить (заглушка Stars)</div>
        <div className="row">
          <button className="btn btnGhost" onClick={() => topup(99)}>99⭐ → 150</button>
          <button className="btn btnGhost" onClick={() => topup(199)}>199⭐ → 350</button>
        </div>
        <div style={{ height: 8 }} />
        <div className="row">
          <button className="btn btnGhost" onClick={() => topup(399)}>399⭐ → 800</button>
          <button className="btn btnGhost" onClick={() => topup(799)}>799⭐ → 1800</button>
        </div>
      </div>

      <div style={{ height: 12 }} />

      {spreads.map((s) => (
        <div key={s.key} className="card" style={{ marginBottom: 12 }}>
          <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div className="title">{s.titleRu}</div>
              <div className="small">{s.cardsCount} карт • цена {s.price}</div>
            </div>
            <button className="btn btnPrimary" onClick={() => buy(s.key)}>Купить</button>
          </div>
        </div>
      ))}

      <Modal open={modal.open} title={modal.title} onClose={() => setModal({ open: false, title: "" })}>
        {!modal.body ? (
          <p className="text">Ок.</p>
        ) : (
          <>
            <div className="small"><b>{modal.body.spreadTitle}</b> • списано {modal.body.paidAmount}</div>
            <div style={{ height: 10 }} />
            <div className="row" style={{ flexWrap: "wrap" }}>
              {modal.body.cards.map((c) => (
                <img key={c.slug} className="img" src={c.image} alt={c.slug} />
              ))}
            </div>
            <hr className="hr" />
            <pre style={{ whiteSpace: "pre-wrap", margin: 0, lineHeight: 1.35 }}>{modal.body.interpretation}</pre>
          </>
        )}
      </Modal>

      <BottomNav />
    </TgAuthGate>
  );
}
