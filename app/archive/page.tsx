"use client";

import { useEffect, useState } from "react";
import { TgAuthGate } from "@/components/TgAuthGate";
import { BottomNav } from "@/components/BottomNav";
import { Modal } from "@/components/Modal";

export default function ArchivePage() {
  const [data, setData] = useState<any>(null);
  const [open, setOpen] = useState(false);
  const [modal, setModal] = useState<{ title: string; body: React.ReactNode }>({ title: "", body: null });

  useEffect(() => {
    fetch("/api/archive").then(r => r.json()).then(setData);
  }, []);

  function openWheel(item: any) {
    setModal({
      title: "Колесо фортуны",
      body: (
        <div className="row">
          <img className="img" src={item.card.image} alt={item.card.titleRu} />
          <div className="col">
            <div className="title">{item.card.titleRu}</div>
            <p className="text">{item.card.meaningRu}</p>
            <div className="small"><b>Совет</b></div>
            <p className="text">{item.card.adviceRu}</p>
          </div>
        </div>
      )
    });
    setOpen(true);
  }

  function openSpread(item: any) {
    setModal({
      title: item.spreadTitle,
      body: (
        <>
          <div className="small">Списано: <b>{item.paidAmount}</b></div>
          <div style={{ height: 10 }} />
          <div className="row" style={{ flexWrap: "wrap" }}>
            {item.cards.map((c: any) => <img key={c.slug} className="img" src={c.image} alt={c.slug} />)}
          </div>
          <hr className="hr" />
          <pre style={{ whiteSpace: "pre-wrap", margin: 0, lineHeight: 1.35 }}>{item.interpretation}</pre>
        </>
      )
    });
    setOpen(true);
  }

  return (
    <TgAuthGate>
      <h1 className="h1">Архив</h1>

      {!data ? (
        <p className="text">Загрузка…</p>
      ) : (
        <>
          <div className="card">
            <div className="title">Колесо</div>
            {data.wheel.length === 0 ? <p className="text">Пока пусто.</p> : data.wheel.map((w: any, idx: number) => (
              <button key={idx} className="btn btnGhost" style={{ width: "100%", marginTop: 8 }} onClick={() => openWheel(w)}>
                {new Date(w.date).toLocaleDateString("ru-RU")} — {w.card.titleRu}
              </button>
            ))}
          </div>

          <div style={{ height: 12 }} />

          <div className="card">
            <div className="title">Расклады</div>
            {data.spreads.length === 0 ? <p className="text">Пока пусто.</p> : data.spreads.map((s: any, idx: number) => (
              <button key={idx} className="btn btnGhost" style={{ width: "100%", marginTop: 8 }} onClick={() => openSpread(s)}>
                {new Date(s.createdAt).toLocaleDateString("ru-RU")} — {s.spreadTitle}
              </button>
            ))}
          </div>
        </>
      )}

      <Modal open={open} title={modal.title} onClose={() => setOpen(false)}>
        {modal.body}
      </Modal>

      <BottomNav />
    </TgAuthGate>
  );
}
