"use client";

import { useState } from "react";
import { Modal } from "@/components/Modal";
import { motion } from "framer-motion";

type User = { id: string; balance: number; username?: string; firstName?: string };
type Api = { user: User | null; refreshMe: () => Promise<void>; setUser: (u: User | null) => void };

const PACKS = [
  { tgStars: 99, coins: 150, label: "Небесная искра" },
  { tgStars: 199, coins: 350, label: "Лунный запас" },
  { tgStars: 399, coins: 800, label: "Созвездие" },
  { tgStars: 799, coins: 1800, label: "Большой оберег" },
];

export function ShopModal({ open, onClose, api }: { open: boolean; onClose: () => void; api: Api }) {
  const [loading, setLoading] = useState<number | null>(null);
  const [msg, setMsg] = useState<string>("");

  async function buyPack(tgStars: number) {
    setLoading(tgStars);
    setMsg("");

    try {
      // пока заглушка Stars:
      const r = await fetch("/api/topup/mock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tgStars }),
      });

      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "topup_failed");

      await api.refreshMe();
      setMsg("Готово ✨ Баланс пополнен.");
    } catch {
      setMsg("Не получилось пополнить. Попробуй ещё раз.");
    } finally {
      setLoading(null);
    }
  }

  return (
    <Modal open={open} title="Магазин" onClose={onClose}>
      <div className="small" style={{ marginBottom: 10 }}>
        Покупка внутриигровой валюты (пока это заглушка; Stars подключим позже).
      </div>

      <div className="col">
        {PACKS.map((p) => (
          <motion.button
            key={p.tgStars}
            whileTap={{ scale: 0.98 }}
            className="btn btnGhost"
            onClick={() => buyPack(p.tgStars)}
            disabled={loading !== null}
            style={{ textAlign: "left" }}
          >
            <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div className="title">{p.label}</div>
                <div className="small">{p.tgStars}⭐ → <b>{p.coins}</b> монет</div>
              </div>
              <div className="badge" style={{ padding: "6px 10px" }}>
                {loading === p.tgStars ? "…" : "Купить"}
              </div>
            </div>
          </motion.button>
        ))}
      </div>

      {msg ? <div className="small" style={{ marginTop: 12 }}><b>{msg}</b></div> : null}
    </Modal>
  );
}
