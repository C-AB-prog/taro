"use client";

import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Modal } from "@/components/Modal";
import { motion } from "framer-motion";
import { SpreadReveal } from "@/components/SpreadReveal";
import { RitualHeader } from "@/components/RitualHeader";
import { IconChevronRight } from "@/components/Icons";

type WheelItem = {
  date: string;
  card: { titleRu: string; meaningRu: string; adviceRu: string; image: string };
};

type SpreadItem = {
  createdAt: string;
  spreadTitle: string;
  paidAmount: number;
  positions?: string[];
  cards: { slug: string; image: string }[];
  interpretation: string;
};

type Item =
  | { kind: "wheel"; ts: string; w: WheelItem }
  | { kind: "spread"; ts: string; s: SpreadItem };

export default function ArchivePage() {
  const [data, setData] = useState<{ wheel: WheelItem[]; spreads: SpreadItem[] } | null>(null);
  const [filter, setFilter] = useState<"all" | "wheel" | "spread">("all");

  const [open, setOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState("");
  const [wheelItem, setWheelItem] = useState<WheelItem | null>(null);
  const [spreadItem, setSpreadItem] = useState<SpreadItem | null>(null);

  useEffect(() => {
    fetch("/api/archive", { cache: "no-store" })
      .then((r) => r.json())
      .then(setData);
  }, []);

  const items: Item[] = useMemo(() => {
    if (!data) return [];
    const all: Item[] = [
      ...data.wheel.map((w) => ({ kind: "wheel", ts: w.date, w })),
      ...data.spreads.map((s) => ({ kind: "spread", ts: s.createdAt, s })),
    ];
    all.sort((a, b) => +new Date(b.ts) - +new Date(a.ts));
    if (filter === "wheel") return all.filter((x) => x.kind === "wheel");
    if (filter === "spread") return all.filter((x) => x.kind === "spread");
    return all;
  }, [data, filter]);

  const counts = useMemo(() => {
    const w = data?.wheel.length ?? 0;
    const s = data?.spreads.length ?? 0;
    return { w, s, all: w + s };
  }, [data]);

  function fmt(d: string) {
    return new Date(d).toLocaleDateString("ru-RU");
  }

  function openWheel(w: WheelItem) {
    setSpreadItem(null);
    setWheelItem(w);
    setModalTitle(`Колесо • ${fmt(w.date)}`);
    setOpen(true);
  }

  function openSpread(s: SpreadItem) {
    setWheelItem(null);
    setSpreadItem(s);
    setModalTitle(`${s.spreadTitle} • ${fmt(s.createdAt)}`);
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
      <RitualHeader label="Твой журнал" />

      <div className="card">
        <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div className="title">Фильтр</div>
            <div className="small">Собранные знаки и расклады</div>
          </div>
          <div className="badge" style={{ padding: "8px 12px" }}>
            {items.length}
          </div>
        </div>

        <div style={{ height: 12 }} />

        <div className="segRow">
          <button
            className={`segBtn ${filter === "all" ? "segBtnActive" : ""}`}
            onClick={() => setFilter("all")}
          >
            Всё • {counts.all}
          </button>
          <button
            className={`segBtn ${filter === "wheel" ? "segBtnActive" : ""}`}
            onClick={() => setFilter("wheel")}
          >
            Колесо • {counts.w}
          </button>
          <button
            className={`segBtn ${filter === "spread" ? "segBtnActive" : ""}`}
            onClick={() => setFilter("spread")}
          >
            Расклады • {counts.s}
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
      ) : items.length === 0 ? (
        <div className="card">
          <div className="title">Пока пусто</div>
          <div className="small" style={{ marginTop: 6 }}>
            Покрути колесо или купи расклад — и здесь появятся записи.
          </div>
        </div>
      ) : (
        <div className="archiveList">
          {items.map((it, i) => {
            if (it.kind === "wheel") {
              const w = it.w;
              return (
                <motion.button
                  key={`w-${w.date}-${i}`}
                  className="card pressable archiveItem"
                  style={{ textAlign: "left", cursor: "pointer" }}
                  whileTap={{ scale: 0.99 }}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.18, delay: Math.min(i, 16) * 0.02 }}
                  onClick={() => openWheel(w)}
                >
                  <div className="archiveRow">
                    <img className="thumb" src={w.card.image} alt={w.card.titleRu} loading="lazy" decoding="async" />
                    <div className="archiveMain">
                      <div className="archiveTitle">{w.card.titleRu}</div>
                      <div className="archiveMeta">{fmt(w.date)} • Колесо фортуны</div>
                    </div>
                    <IconChevronRight className="chev" />
                  </div>
                </motion.button>
              );
            }

            const s = it.s;
            const preview = s.cards.slice(0, 3);
            return (
              <motion.button
                key={`s-${s.createdAt}-${i}`}
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
                    {preview[0] ? <img className="thumb t1" src={preview[0].image} alt="" loading="lazy" decoding="async" /> : null}
                    {preview[1] ? <img className="thumb t2" src={preview[1].image} alt="" loading="lazy" decoding="async" /> : null}
                    {preview[2] ? <img className="thumb t3" src={preview[2].image} alt="" loading="lazy" decoding="async" /> : null}
                  </div>

                  <div className="archiveMain">
                    <div className="archiveTitle">{s.spreadTitle}</div>
                    <div className="archiveMeta">
                      {fmt(s.createdAt)} • {s.cards.length} карт • списано {s.paidAmount}
                    </div>
                  </div>

                  <IconChevronRight className="chev" />
                </div>
              </motion.button>
            );
          })}
        </div>
      )}

      <Modal open={open} title={modalTitle} onClose={() => setOpen(false)}>
        {wheelItem ? (
          <div className="row">
            <img className="img" src={wheelItem.card.image} alt={wheelItem.card.titleRu} loading="lazy" decoding="async" />
            <div className="col">
              <div className="title" style={{ fontSize: 16 }}>{wheelItem.card.titleRu}</div>
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
