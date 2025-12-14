"use client";

import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Modal } from "@/components/Modal";
import { RitualHeader } from "@/components/RitualHeader";

type SpreadItem = {
  kind: "spread";
  id: string;
  ts: string;
  title: string;
  paidAmount: number;
  positions: string[];
  cards: { slug: string; titleRu: string; image: string }[];
  interpretation: string;
};

type WheelItem = {
  kind: "wheel";
  id: string;
  ts: string;
  card: { slug: string; titleRu: string; meaningRu: string; adviceRu: string; image: string };
};

type Item = SpreadItem | WheelItem;
type Tab = "spread" | "wheel";

function splitInterpretation(text: string) {
  const t = String(text || "").trim();
  if (!t) return { main: "", advice: "" };
  const idx = t.toLowerCase().lastIndexOf("совет:");
  if (idx >= 0) {
    const main = t.slice(0, idx).trim();
    const advice = t.slice(idx).replace(/^совет:\s*/i, "").trim();
    return { main, advice };
  }
  return { main: t, advice: "" };
}

export default function ArchivePage() {
  const [tab, setTab] = useState<Tab>("spread"); // по умолчанию расклады
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<Item | null>(null);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const r = await fetch("/api/archive", { cache: "no-store", credentials: "include" });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d?.ok) {
        setErr(r.status === 401 ? "Нет сессии. Открой мини-приложение через Telegram." : "Не удалось загрузить архив.");
        setItems([]);
        setLoading(false);
        return;
      }
      setItems(Array.isArray(d.items) ? d.items : []);
      setLoading(false);
    } catch {
      setErr("Ошибка сети.");
      setItems([]);
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => items.filter((x) => x.kind === tab), [items, tab]);

  function openItem(it: Item) {
    setPicked(it);
    setOpen(true);
  }

  return (
    <AppShell>
      <RitualHeader label="Архив" />

      <div className="card" style={{ padding: 12 }}>
        <div className="segRowEqual">
          <button className={`segBtn ${tab === "spread" ? "segBtnActive" : ""}`} onClick={() => setTab("spread")} type="button">
            Расклады
          </button>
          <button className={`segBtn ${tab === "wheel" ? "segBtnActive" : ""}`} onClick={() => setTab("wheel")} type="button">
            Колесо
          </button>
        </div>
      </div>

      <div style={{ height: 12 }} />

      {loading ? (
        <div className="card"><div className="small">Загружаю…</div></div>
      ) : err ? (
        <div className="card"><div className="small"><b>Ошибка:</b> {err}</div></div>
      ) : filtered.length === 0 ? (
        <div className="card"><div className="small">Пока пусто ✨</div></div>
      ) : (
        <div className="archiveList">
          {filtered.map((it) => {
            const dt = new Date(it.ts);
            const dateRu = dt.toLocaleString("ru-RU", { day: "2-digit", month: "long", hour: "2-digit", minute: "2-digit" });

            if (it.kind === "spread") {
              return (
                <button key={it.id} className="card pressable archiveItem" onClick={() => openItem(it)} style={{ textAlign: "left" }}>
                  <div className="archiveRow">
                    <div className="thumbStack" aria-hidden="true">
                      {it.cards.slice(0, 3).map((c, i) => (
                        <img key={c.slug + i} className={`thumb ${i === 0 ? "t1" : i === 1 ? "t2" : "t3"}`} src={c.image} alt="" />
                      ))}
                    </div>
                    <div className="archiveMain">
                      <div className="archiveTitle">{it.title}</div>
                      <div className="archiveMeta">{dateRu} • {it.paidAmount} валюты</div>
                    </div>
                  </div>
                </button>
              );
            }

            return (
              <button key={it.id} className="card pressable archiveItem" onClick={() => openItem(it)} style={{ textAlign: "left" }}>
                <div className="archiveRow">
                  <img className="thumb" src={it.card.image} alt="" />
                  <div className="archiveMain">
                    <div className="archiveTitle">Колесо: {it.card.titleRu}</div>
                    <div className="archiveMeta">{dateRu}</div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      <Modal open={open} title={picked?.kind === "spread" ? picked.title : "Колесо"} onClose={() => setOpen(false)}>
        {!picked ? (
          <p className="text">…</p>
        ) : picked.kind === "wheel" ? (
          <div className="row">
            <img className="img" src={picked.card.image} alt={picked.card.titleRu} />
            <div className="col">
              <div className="title" style={{ fontSize: 16 }}>{picked.card.titleRu}</div>
              <p className="text" style={{ marginTop: 8 }}>{picked.card.meaningRu}</p>
              <div className="adviceBox" style={{ marginTop: 12 }}>
                <div className="adviceTitle">Совет</div>
                <div className="adviceText">{picked.card.adviceRu}</div>
              </div>
            </div>
          </div>
        ) : (
          <SpreadArchiveView it={picked} />
        )}
      </Modal>
    </AppShell>
  );
}

function SpreadArchiveView({ it }: { it: SpreadItem }) {
  const [openMap, setOpenMap] = useState<boolean[]>(() => it.cards.map(() => false));

  const opened = openMap.filter(Boolean).length;
  const allOpen = opened === it.cards.length;

  const { main, advice } = useMemo(() => splitInterpretation(it.interpretation), [it.interpretation]);

  return (
    <div>
      <div className="card" style={{ padding: 12 }}>
        <div className="small">Открой все карты, чтобы увидеть трактовку.</div>
        <div className="small" style={{ marginTop: 6, opacity: 0.85 }}>
          Открыто: <b>{opened}</b>/<b>{it.cards.length}</b>
        </div>
      </div>

      <div style={{ height: 12 }} />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
        {it.cards.map((c, i) => {
          const isOpen = openMap[i];
          const pos = it.positions?.[i] ?? `Карта ${i + 1}`;

          return (
            <button
              key={c.slug + i}
              className="pressable"
              onClick={() =>
                setOpenMap((p) => {
                  const n = p.slice();
                  n[i] = !n[i];
                  return n;
                })
              }
              style={{
                border: "1px solid rgba(20,16,10,.10)",
                background: "rgba(255,255,255,.80)",
                borderRadius: 18,
                padding: 10,
                textAlign: "left",
              }}
            >
              <div className="small" style={{ fontWeight: 900, marginBottom: 8 }}>{pos}</div>

              <div style={{ width: "100%", aspectRatio: "2 / 3", borderRadius: 16, overflow: "hidden", border: "1px solid rgba(20,16,10,.10)" }}>
                <div
                  style={{
                    width: "100%",
                    height: "100%",
                    position: "relative",
                    transformStyle: "preserve-3d",
                    transition: "transform 650ms cubic-bezier(.2,.7,.2,1)",
                    transform: isOpen ? "rotateY(180deg)" : "rotateY(0deg)",
                  }}
                >
                  <div style={{ position: "absolute", inset: 0, backfaceVisibility: "hidden" }}>
                    <img src="/cards/card-back.jpg" alt="Рубашка" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    <div className="flipShine" />
                  </div>
                  <div style={{ position: "absolute", inset: 0, backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}>
                    <img src={c.image} alt={c.titleRu} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  </div>
                </div>
              </div>

              <div className="small" style={{ marginTop: 8, fontWeight: 900 }}>
                {isOpen ? c.titleRu : "…"}
              </div>
            </button>
          );
        })}
      </div>

      <div style={{ height: 12 }} />

      {!allOpen ? (
        <div className="card">
          <div className="title" style={{ fontSize: 16 }}>Трактовка скрыта</div>
          <div className="small" style={{ marginTop: 6 }}>Открой все карты — и текст появится.</div>
        </div>
      ) : (
        <div className="card">
          <div className="title" style={{ fontSize: 16 }}>Трактовка</div>
          <p className="text" style={{ marginTop: 10, whiteSpace: "pre-wrap" }}>
            {main || it.interpretation}
          </p>
          {advice ? (
            <div className="adviceBox" style={{ marginTop: 12 }}>
              <div className="adviceTitle">Совет</div>
              <div className="adviceText">{advice}</div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
