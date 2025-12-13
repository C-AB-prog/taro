"use client";

import { useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Modal } from "@/components/Modal";

type Card = { slug: string; titleRu: string; meaningRu: string; adviceRu: string; image: string };

function hapticImpact(style: "light" | "medium" | "heavy" | "rigid" | "soft") {
  const h = window.Telegram?.WebApp?.HapticFeedback;
  h?.impactOccurred?.(style);
}
function hapticSuccess() {
  const h = window.Telegram?.WebApp?.HapticFeedback;
  h?.notificationOccurred?.("success");
}

function makeSparkles(n = 16) {
  return Array.from({ length: n }).map((_, i) => ({
    id: i + 1,
    x: Math.random() * 220,
    y: Math.random() * 220,
    s: 0.6 + Math.random() * 1.2,
    d: 0.15 + Math.random() * 0.35,
  }));
}

export function Wheel() {
  const [spinning, setSpinning] = useState(false);
  const [deg, setDeg] = useState(0);
  const [open, setOpen] = useState(false);
  const [already, setAlready] = useState(false);
  const [card, setCard] = useState<Card | null>(null);

  const [sparkles, setSparkles] = useState(() => makeSparkles(0));
  const timeRef = useRef<number | null>(null);

  const wheelTransition = useMemo(() => ({ duration: 2.4, ease: [0.15, 0.85, 0.2, 1] as any }), []);

  async function spin() {
    if (spinning) return;

    setSpinning(true);
    setOpen(false);

    hapticImpact("light");

    const r = await fetch("/api/wheel/spin", { method: "POST" });
    const d = await r.json();

    if (!r.ok) {
      setSpinning(false);
      return;
    }

    setAlready(!!d.already);
    setCard(d.card);

    // если уже крутил — просто покажем модалку (и мягкий хаптик)
    if (d.already) {
      hapticImpact("soft");
      setOpen(true);
      setSpinning(false);
      return;
    }

    // искры на старте
    setSparkles(makeSparkles(18));

    // красивое вращение
    const extra = 1440 + Math.floor(Math.random() * 360); // 4 оборота + рандом
    const next = deg + extra;
    setDeg(next);

    // показать результат после прокрутки
    if (timeRef.current) window.clearTimeout(timeRef.current);
    timeRef.current = window.setTimeout(() => {
      hapticSuccess();
      setOpen(true);
      setSpinning(false);
      setSparkles(makeSparkles(0));
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
        <div className="sparkStage">
          <motion.div className="wheel" animate={{ rotate: deg }} transition={wheelTransition} />

          <div className="sparkLayer">
            {sparkles.map((p) => (
              <motion.div
                key={p.id}
                className="sparkDot"
                style={{ left: p.x, top: p.y }}
                initial={{ opacity: 0, scale: 0.2 }}
                animate={{ opacity: [0, 1, 0], scale: [0.2, p.s, 0.2], y: [0, -10, -22] }}
                transition={{ duration: 0.7, delay: p.d }}
              />
            ))}
          </div>
        </div>
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
            <img className="img" src={card.image} alt={card.titleRu} loading="lazy" />
            <div className="col">
              <div className="title" style={{ fontSize: 16 }}>{card.titleRu}</div>
              <p className="text" style={{ marginTop: 6 }}>{card.meaningRu}</p>
              <div className="small" style={{ marginTop: 8 }}><b>Совет</b></div>
              <p className="text" style={{ marginTop: 6 }}>{card.adviceRu}</p>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
