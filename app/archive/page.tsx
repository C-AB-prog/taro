"use client";

import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Modal } from "@/components/Modal";
import { motion } from "framer-motion";
import { SpreadReveal } from "@/components/SpreadReveal";
import { RitualHeader } from "@/components/RitualHeader";
import { ruTitleFromSlug } from "@/lib/ruTitles";

type WheelItem = {
  date: string;
  card: {
    slug?: string; // может прийти, может нет
    titleRu: string;
    meaningRu: string;
    adviceRu: string;
    image: string;
  };
};

type SpreadItem = {
  createdAt: string;
  spreadTitle: string;
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

    const t = item.card.slug ? ruTitleFromSlug(item.card.slug) : item.card.titleRu;
    setModalTitle(`${fmt(item.date)} • ${t}`);
    setOpen(true);
  }

  function openSpread(item: SpreadItem) {
    setWheelItem(null);
    setSpreadItem(item);
    setModalTitle(`${fmt(item.createdAt)} • ${item.spreadTitle}`);
    setOpen(true);
  }

  const resetToken = useMemo(() => {
    if (!spreadItem) return "none";
    return `${spreadItem.spreadTitle}|${spreadItem.paidAmount}|${spreadItem.cards.map((c) => c.slug).join(",")}|${spreadItem.createdAt}`;
  }, [spreadItem]);

  const spreadPositions =
    spreadItem?.positions ?? spreadItem?.cards.map((_, i) => `Позиция ${i + 1}`) ?? [];

  return (
    <AppShell title="Архив">
      <h1 className="h1">Архив</h1>
      <RitualHeader label="Твоя история" />

      <div className="card">
        <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div className="title">Раздел</div>
            <div className="small">Выбери, что смотреть</div>
          </div>
          <div className="badge" style={{ padding: "8px 12px" }}>
            {tab === "wheel" ? wheel.length : spreads.length}
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
        wheel.length === 0 ? (
          <div className="card">
            <div className="title">Пока пусто</div>
            <div className="small" style={{ marginTop: 6 }}>
              Покрути колесо на главной — и здесь появится запись.
            </div>
          </div>
        ) : (
          <div className="archiveList">
            {wheel.map((w, i) => {
              const title = w.card.slug ? ruTitleFromSlug(w.card.slug) : w.card.titleRu;
              return (
                <motion.button
                  key={i}
                  className="card pressable archiveItem"
                  style={{ textAlign: "left", cursor: "pointer" }}
                  whileTap={{ scale: 0.99 }}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.18, delay: Math.min(i, 16) * 0.02 }}
                  onClick={() => openWheel(w)}
                >
                  <div className="archiveRow">
                    <img
                      className="thumb"
                      src={w.card.image}
                      alt={title}
                      loading="lazy"
                      decoding="async"
                    />
                    <div className="archiveMain">
                      <div className="archiveTitle">{title}</div>
                      <div className="archiveMeta">{fmt(w.date)} • Колесо фортуны</div>
                    </div>
                  </div>
                </motion.button>
              );
            })}
          </div>
        )
      ) : spreads.length === 0 ? (
        <div className="card">
          <div className="title">Пока пусто</div>
          <div className="small" style={{ marginTop: 6 }}>
            Купи расклад — и он появится здесь.
          </div>
        </div>
      ) : (
        <div className="archiveList">
          {spreads.map((s, i) => {
            const preview = s.cards.slice(0, 3);
            return (
              <motion.button
                key={i}
                className="card pressable archiveItem"
                style={{ textAlign: "left", cursor: "pointer" }}
                whileTap={{ scale: 0.99 }}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.18, delay: Math.min(i, 16) * 0.02 }}
                onClick={() => openSpread(s)}
              >
                <div className="archiveRow">
                  <div className="thumbStack">
                    {preview[0] ? (
                      <img className="thumb t1" src={preview[0].image} alt="" loading="lazy" decoding="async" />
                    ) : null}
                    {preview[1] ? (
                      <img className="thumb t2" src={preview[1].image} alt="" loading="lazy" decoding="async" />
                    ) : null}
                    {preview[2] ? (
                      <img className="thumb t3" src={preview[2].image} alt="" loading="lazy" decoding="async" />
                    ) : null}
                  </div>

                  <div className="archiveMain">
                    <div className="archiveTitle">{s.spreadTitle}</div>
                    <div className="archiveMeta">
                      {fmt(s.createdAt)} • {s.cards.length} карт • списано {s.paidAmount}
                    </div>
                  </div>
                </div>
              </motion.button>
            );
          })}
        </div>
      )}

      <Modal open={open} title={modalTitle} onClose={() => setOpen(false)}>
        {wheelItem ? (
          <div className="row">
            <img className="img" src={wheelItem.card.image} alt="" loading="lazy" decoding="async" />
            <div className="col">
              <div className="title" style={{ fontSize: 16 }}>
                {wheelItem.card.slug ? ruTitleFromSlug(wheelItem.card.slug) : wheelItem.card.titleRu}
              </div>
              <p className="text" style={{ marginTop: 6 }}>{wheelItem.card.meaningRu}</p>
              <div className="small" style={{ marginTop: 8 }}><b>Совет</b></div>
              <p className="text" style={{ marginTop: 6 }}>{wheelItem.card.adviceRu}</p>
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
