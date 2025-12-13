"use client";

import { useEffect, useState } from "react";
import { TgAuthGate } from "@/components/TgAuthGate";
import { BottomNav } from "@/components/BottomNav";
import { Modal } from "@/components/Modal";

type Card = { slug: string; titleRu: string; meaningRu: string; adviceRu: string; image: string };

export default function HomePage() {
  const [daily, setDaily] = useState<Card | null>(null);
  const [wheel, setWheel] = useState<{ already: boolean; card: Card } | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    fetch("/api/daily-card").then(r => r.json()).then(d => setDaily(d.card));
  }, []);

  async function spin() {
    const r = await fetch("/api/wheel/spin", { method: "POST" });
    const d = await r.json();
    setWheel({ already: d.already, card: d.card });
    setOpen(true);
  }

  return (
    <TgAuthGate>
      <h1 className="h1">Главная</h1>

      <div className="card">
        <div className="title">Карта дня</div>
        {!daily ? (
          <p className="text">Загрузка…</p>
        ) : (
          <div className="row">
            <img className="img" src={daily.image} alt={daily.titleRu} />
            <div className="col">
              <div>
                <div className="title">{daily.titleRu}</div>
                <p className="text">{daily.meaningRu}</p>
              </div>
              <div>
                <div className="small"><b>Совет</b></div>
                <p className="text">{daily.adviceRu}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      <div style={{ height: 12 }} />

      <div className="card">
        <div className="title">Колесо фортуны</div>
        <p className="text">Можно крутить 1 раз в сутки.</p>
        <div style={{ height: 10 }} />
        <button className="btn btnPrimary" onClick={spin}>Крутить</button>
      </div>

      <Modal
        open={open}
        title={wheel?.already ? "Ты уже крутил сегодня" : "Результат колеса"}
        onClose={() => setOpen(false)}
      >
        {wheel && (
          <div className="row">
            <img className="img" src={wheel.card.image} alt={wheel.card.titleRu} />
            <div className="col">
              <div className="title">{wheel.card.titleRu}</div>
              <p className="text">{wheel.card.meaningRu}</p>
              <div className="small"><b>Совет</b></div>
              <p className="text">{wheel.card.adviceRu}</p>
            </div>
          </div>
        )}
      </Modal>

      <BottomNav />
    </TgAuthGate>
  );
}
