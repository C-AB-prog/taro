"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Modal } from "@/components/Modal";

type Card = { slug: string; titleRu: string; meaningRu: string; adviceRu: string; image: string };

export function Wheel() {
  const [spinning, setSpinning] = useState(false);
  const [deg, setDeg] = useState(0);
  const [open, setOpen] = useState(false);
  const [already, setAlready] = useState(false);
  const [card, setCard] = useState<Card | null>(null);

  async function spin() {
    if (spinning) return;
    setSpinning(true);

    const r = await fetch("/api/wheel/spin", { method: "POST" });
    const d = await r.json();

    if (!r.ok) {
      setSpinning(false);
      return;
    }

    setAlready(!!d.already);
    setCard(d.card);

    // если уже крутил сегодня — сразу показываем
    if (d.already) {
      setOpen(true);
      setSpinning(false);
      return;
    }

    // красивое вращение
    const extra = 1440 + Math.floor(Math.random() * 360); // 4 оборота + рандом
    const next = deg + extra;
    setDeg(next);

    // показываем результат после прокрутки
    setTimeout(() => {
      setOpen(true);
      setSpinning(false);
    }, 2600);
  }

  return (
    <div className="card">
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div className="title">Колесо фортуны</div>
          <div className="small">Можно крутить 1 раз в сутки</div>
        </div>
        <button className="btn btnPrimary" onClick={spin} disabled={spinning}>
          {spinning ? "Крутим…" : "Крутить"}
        </button>
      </div>

      <div style={{ height: 12 }} />
      <div className="pointer" />
      <div className="wheelWrap">
        <motion.div
          className="wheel"
          animate={{ rotate: deg }}
          transition={{ duration: 2.4, ease: [0.15, 0.85, 0.2, 1] }}
        />
      </div>

      <Modal
        open={open}
        title={already ? "Ты уже крутил сегодня" : "Твой знак колеса"}
        onClose={() => setOpen(false)}
      >
        {!card ? (
          <p className="text">…</p>
        ) : (
          <div className="row">
            <img className="img" src={card.image} alt={card.titleRu} />
            <div className="col">
              <div className="title" style={{ fontSize: 16 }}>{card.titleRu}</div>
              <p className="text">{card.meaningRu}</p>
              <div className="small"><b>Совет</b></div>
              <p className="text">{card.adviceRu}</p>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
