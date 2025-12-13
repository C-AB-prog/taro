"use client";

import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Modal } from "@/components/Modal";
import { motion } from "framer-motion";
import { SpreadReveal } from "@/components/SpreadReveal";
import { RitualHeader } from "@/components/RitualHeader";

type WheelItem = {
  date: string;
  card: { titleRu: string; meaningRu: string; adviceRu: string; image: string };
};

type SpreadItem = {
  createdAt: string;
  spreadTitle: string;
  spreadKey?: string;
  paidAmount: number;
  positions?: string[];
  cards: { slug: string; image: string }[];
  interpretation: string;
};

export default function ArchivePage() {
  const [data, setData] = useState<{ wheel: WheelItem[]; spreads: SpreadItem[] } | null>(null);
  const [tab, setTab] = useState<"wheel" | "spreads">("wheel");

  const [open, setOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState("");
  const [wheelItem, setWheelItem] = useState<WheelItem | null>(null);
  const [spreadItem, setSpreadItem] = useState<SpreadItem | null>(null);

  useEffect(() => {
    fetch("/api/archive", { cache: "no-store" })
      .then((r) => r.json())
      .then(setData);
  }, []);

  const wheel = useMemo(() => data?.wheel ?? [], [data]);
  const spreads = useMemo(() => data?.spreads ?? [], [data]);

  function fmt(d: string) {
    return new Date(d).toLocaleDateString("ru-RU");
  }

  function openWheel(item: WheelItem) {
    setSpreadItem(null);
    setWheelItem(item);
    setModalTitle(`Колесо • ${fmt(item.date)}`);
    setOpen(true);
  }

  function openSpread(item: SpreadItem) {
    setWheelItem(null);
    setSpreadItem(item);
    setModalTitle(`${item.spreadTitle} • ${fmt(item.createdAt)}`);
    setOpen(true);
  }

  const resetToken = useMemo(() => {
    if (!spreadItem) return "none";
    return `${spreadItem.spreadTitle}|${spreadItem.paidAmount}|${spreadItem.cards.map((c) => c.slug).join(",")}|${spreadItem.createdAt}`;
  }, [spreadItem]);

  const spreadPositions =
    spreadItem?.positions ??
    spreadItem?.cards.map((_, i) => `Позиция ${i + 1}`) ??
    [];

  return (
    <AppShell title="Архив">
      <h1 className="h1">Архив</h1>
      <RitualHeader label="Следы твоих раскладов" />

      <div className="card">
        <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div className="title">История</div>
            <div className="small">Все твои прокруты и расклады сохраняются здесь</div>
          </div>
          <div className="badge" style={{ padding: "8px 12px" }}>
            {tab === "wheel" ? `${wheel.length} прокрутов` : `${spreads.length} раскладов`}
          </div>
        </div>

        <div style={{ height: 12 }} />

        <div className="row">
          <button
            className={`btn ${tab === "wheel" ? "btnPrimary" : "btnGhost"}`}
            onClick={() => setTab("wheel")}
            style={{ flex: 1 }}
          >
            Колесо
          </button>
          <button
            className={`btn ${tab === "spreads" ? "btnPrimary" : "btnGhost"}`}
            onClick={() => setTab("spreads")}
            style={{ flex: 1 }}
          >
            Расклады
          </button>
        </div>
      </div>

      <div style={{ height: 12 }} />

      {!data ? (
        <div className="card">
          <div className="shimmer" style={{ height: 14, width: "55%" }} />
          <div style={{ height: 10 }} />
          <div className="shimmer" style={{ height: 12, width: "92%" }} />
          <div style={{ height: 8 }} />
          <div className="shimmer" style={{ height: 12, width: "86%" }} />
        </div>
      ) : tab === "wheel" ? (
        <div className="col">
          {wheel.length === 0 ? (
            <div className="card">
              <div className="title">Пока пусто</div>
              <div className="small" style={{ marginTop: 6 }}>
                Покрути колесо на главной — и здесь появится запись.
              </div>
            </div>
          ) : (
            wheel.map((w, i) => (
              <motion.button
                key={i}
                className="card pressable"
                style={{ textAlign: "left", cursor: "pointer" }}
                whileTap={{ scale: 0.99 }}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: Math.min(i, 14) * 0.02 }}
                onClick={() => openWheel(w)}
              >
                <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div className="title">{w.card.titleRu}</div>
                    <div className="small">{fmt(w.date)} • Колесо фортуны</div>
                  </div>
                  <div className="badge" style={{ padding: "8px 12px" }}>
                    Открыть
                  </div>
                </div>
              </motion.button>
            ))
          )}
        </div>
      ) : (
        <div className="col">
          {spreads.length === 0 ? (
            <div className="card">
              <div className="title">Пока пусто</div>
              <div className="small" style={{ marginTop: 6 }}>
                Купи расклад — и он появится здесь.
              </div>
            </div>
          ) : (
            spreads.map((s, i) => (
              <motion.button
                key={i}
                className="card pressable"
                style={{ textAlign: "left", cursor: "pointer" }}
                whileTap={{ scale: 0.99 }}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: Math.min(i, 14) * 0.02 }}
                onClick={() => openSpread(s)}
              >
                <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div className="title">{s.spreadTitle}</div>
                    <div className="small">
                      {fmt(s.createdAt)} • списано {s.paidAmount}
                    </div>
                  </div>
                  <div className="badge" style={{ padding: "8px 12px" }}>
                    Открыть
                  </div>
                </div>
              </motion.button>
            ))
          )}
        </div>
      )}

      <Modal open={open} title={modalTitle} onClose={() => setOpen(false)}>
        {wheelItem ? (
          <div className="row">
            <img
              className="img"
              src={wheelItem.card.image}
              alt={wheelItem.card.titleRu}
              loading="lazy"
              decoding="async"
            />
            <div className="col">
              <div className="title" style={{ fontSize: 16 }}>
                {wheelItem.card.titleRu}
              </div>
              <p className="text" style={{ marginTop: 6 }}>
                {wheelItem.card.meaningRu}
              </p>
              <div className="small" style={{ marginTop: 8 }}>
                <b>Совет</b>
              </div>
              <p className="text" style={{ marginTop: 6 }}>
                {wheelItem.card.adviceRu}
              </p>
            </div>
          </div>
        ) : spreadItem ? (
          <>
            <div className="small" style={{ marginBottom: 10 }}>
              Списано: <b>{spreadItem.paidAmount}</b>
            </div>
            <SpreadReveal
              cards={spreadItem.cards}
              positions={spreadPositions}
              interpretation={spreadItem.interpretation}
              resetToken={resetToken}
            />
          </>
        ) : (
          <p className="text">…</p>
        )}
      </Modal>
    </AppShell>
  );
}
