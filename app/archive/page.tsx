"use client";

import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Modal } from "@/components/Modal";
import { motion } from "framer-motion";

type WheelItem = {
  date: string;
  card: { titleRu: string; meaningRu: string; adviceRu: string; image: string };
};

type SpreadItem = {
  createdAt: string;
  spreadTitle: string;
  paidAmount: number;
  cards: { slug: string; image: string }[];
  interpretation: string;
};

export default function ArchivePage() {
  const [data, setData] = useState<{ wheel: WheelItem[]; spreads: SpreadItem[] } | null>(null);
  const [tab, setTab] = useState<"wheel" | "spreads">("wheel");
  const [open, setOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState("");
  const [modalBody, setModalBody] = useState<React.ReactNode>(null);

  useEffect(() => {
    async function load() {
      const r = await fetch("/api/archive", { cache: "no-store" });
      const d = await r.json();
      setData(d);
    }
    load();
  }, []);

  const wheel = useMemo(() => data?.wheel ?? [], [data]);
  const spreads = useMemo(() => data?.spreads ?? [], [data]);

  function fmt(d: string) {
    return new Date(d).toLocaleDateString("ru-RU");
  }

  function openWheel(item: WheelItem) {
    setModalTitle(`Колесо • ${fmt(item.date)}`);
    setModalBody(
      <div className="row">
        <img className="img" src={item.card.image} alt={item.card.titleRu} />
        <div className="col">
          <div className="title" style={{ fontSize: 16 }}>{item.card.titleRu}</div>
          <p className="text" style={{ marginTop: 6 }}>{item.card.meaningRu}</p>
          <div className="small" style={{ marginTop: 8 }}><b>Совет</b></div>
          <p className="text" style={{ marginTop: 6 }}>{item.card.adviceRu}</p>
        </div>
      </div>
    );
    setOpen(true);
  }

  function openSpread(item: SpreadItem) {
    setModalTitle(`${item.spreadTitle} • ${fmt(item.createdAt)}`);
    setModalBody(
      <>
        <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
          <div className="small">Списано: <b>{item.paidAmount}</b></div>
          <div className="badge" style={{ padding: "8px 12px" }}>
            {item.cards.length} карт
          </div>
        </div>

        <div style={{ height: 10 }} />

        <div className="row" style={{ flexWrap: "wrap" }}>
          {item.cards.map((c) => (
            <motion.img
              key={c.slug}
              className="img"
              src={c.image}
              alt={c.slug}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18 }}
              style={{ width: 80, height: 130 }}
            />
          ))}
        </div>

        <hr className="hr" />

        <pre style={{ whiteSpace: "pre-wrap", margin: 0, lineHeight: 1.45, color: "rgba(255,255,255,.9)" }}>
          {item.interpretation}
        </pre>
      </>
    );
    setOpen(true);
  }

  return (
    <AppShell title="Архив">
      <h1 className="h1">Архив</h1>

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
              <div className="small" style={{ marginTop: 6 }}>Покрути колесо на главной — и здесь появится запись.</div>
            </div>
          ) : (
            wheel.map((w, i) => (
              <motion.button
                key={i}
                className="card"
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
                  <div className="badge" style={{ padding: "8px 12px" }}>Открыть</div>
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
              <div className="small" style={{ marginTop: 6 }}>Купи расклад — и он появится здесь.</div>
            </div>
          ) : (
            spreads.map((s, i) => (
              <motion.button
                key={i}
                className="card"
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
                    <div className="small">{fmt(s.createdAt)} • списано {s.paidAmount}</div>
                  </div>
                  <div className="badge" style={{ padding: "8px 12px" }}>Открыть</div>
                </div>
              </motion.button>
            ))
          )}
        </div>
      )}

      <Modal open={open} title={modalTitle} onClose={() => setOpen(false)}>
        {modalBody}
      </Modal>
    </AppShell>
  );
}
