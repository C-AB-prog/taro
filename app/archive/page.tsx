"use client";

import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Modal } from "@/components/Modal";
import { SpreadReveal } from "@/components/SpreadReveal";
import { ruTitleFromSlug } from "@/lib/ruTitles";

type WheelCard = {
  slug?: string;
  titleRu?: string;
  meaningRu: string;
  adviceRu: string;
  image: string;
};

type WheelItem = {
  id?: string;
  createdAt?: string;
  date?: string;
  card?: WheelCard; // чаще так
  // иногда сразу поля карты
  slug?: string;
  titleRu?: string;
  meaningRu?: string;
  adviceRu?: string;
  image?: string;
};

type SpreadItem = {
  id?: string;
  createdAt?: string;
  date?: string;
  spreadTitle?: string;
  title?: string;
  positions?: string[];
  interpretation: string;
  cards: { slug: string; image: string }[];
};

type Item =
  | { kind: "spread"; ts: string; s: SpreadItem }
  | { kind: "wheel"; ts: string; w: WheelItem };

function safeDate(ts: string) {
  const t = ts ? new Date(ts) : null;
  if (!t || Number.isNaN(t.getTime())) return "";
  return t.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function wheelCardOf(w: WheelItem): WheelCard | null {
  const c = (w as any).card;
  if (c && c.image) return c as WheelCard;

  // fallback если сервер сохраняет прямо поля карты
  if ((w as any).image && (w as any).meaningRu && (w as any).adviceRu) {
    return {
      slug: (w as any).slug,
      titleRu: (w as any).titleRu,
      meaningRu: String((w as any).meaningRu),
      adviceRu: String((w as any).adviceRu),
      image: String((w as any).image),
    };
  }
  return null;
}

function wheelTitle(c: WheelCard | null) {
  if (!c) return "Карта";
  if (c.slug) return ruTitleFromSlug(c.slug);
  return c.titleRu ?? "Карта";
}

function spreadTitle(s: SpreadItem) {
  return s.spreadTitle || s.title || "Расклад";
}

export default function ArchivePage() {
  const [raw, setRaw] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<Item | null>(null);
  const [resetToken, setResetToken] = useState("0");

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const r = await fetch("/api/archive", { cache: "no-store" });
        const d = await r.json().catch(() => ({}));
        setRaw(d);
      } catch {
        setRaw({ wheel: [], spreads: [] });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const items: Item[] = useMemo(() => {
    const d = raw ?? {};

    const wheelRaw: WheelItem[] =
      d.wheel ?? d.wheelSpins ?? d.wheelItems ?? [];

    const spreadsRaw: SpreadItem[] =
      d.spreads ?? d.spreadPurchases ?? d.purchases ?? [];

    const wheelItems: Item[] = (wheelRaw || []).map((w) => ({
      kind: "wheel" as const,
      ts: String(w.createdAt ?? w.date ?? ""),
      w,
    }));

    const spreadItems: Item[] = (spreadsRaw || []).map((s) => ({
      kind: "spread" as const,
      ts: String(s.createdAt ?? s.date ?? ""),
      s,
    }));

    const toTime = (it: Item) => {
      const t = new Date(it.ts || 0).getTime();
      return Number.isFinite(t) ? t : 0;
    };

    // ✅ сначала расклады, потом колесо
    spreadItems.sort((a, b) => toTime(b) - toTime(a));
    wheelItems.sort((a, b) => toTime(b) - toTime(a));

    return [...spreadItems, ...wheelItems];
  }, [raw]);

  function openItem(it: Item) {
    setPicked(it);
    setResetToken(String(Date.now()));
    setOpen(true);
    window.Telegram?.WebApp?.HapticFeedback?.selectionChanged?.();
  }

  return (
    <AppShell title="Архив">
      <h1 className="h1">Архив</h1>
      <div className="small">
        Здесь хранятся все спины колеса и купленные расклады. Записи неизменны.
      </div>

      <div style={{ height: 12 }} />

      {loading ? (
        <div className="card">
          <div className="shimmer" style={{ height: 14, width: "70%" }} />
          <div style={{ height: 10 }} />
          <div className="shimmer" style={{ height: 12, width: "92%" }} />
        </div>
      ) : null}

      {!loading && items.length === 0 ? (
        <div className="card">
          <div className="small">Пока пусто.</div>
        </div>
      ) : null}

      <div className="archiveList" style={{ marginTop: 12 }}>
        {items.map((it, idx) => {
          if (it.kind === "wheel") {
            const c = wheelCardOf(it.w);
            const title = wheelTitle(c);
            return (
              <button
                key={`w-${idx}`}
                className="card archiveItem pressable"
                style={{ textAlign: "left", cursor: "pointer" }}
                onClick={() => openItem(it)}
              >
                <div className="archiveRow">
                  {c?.image ? (
                    <img
                      className="thumb"
                      src={c.image}
                      alt={title}
                      loading="lazy"
                      decoding="async"
                    />
                  ) : (
                    <div className="thumb shimmer" />
                  )}

                  <div className="archiveMain">
                    <div className="archiveTitle">Колесо • {title}</div>
                    <div className="archiveMeta">{safeDate(it.ts)}</div>
                  </div>
                </div>
              </button>
            );
          }

          const s = it.s;
          const cards = (s as any).cards ?? [];
          const t = spreadTitle(s);

          const img1 = cards?.[0]?.image;
          const img2 = cards?.[1]?.image;
          const img3 = cards?.[2]?.image;

          return (
            <button
              key={`s-${idx}`}
              className="card archiveItem pressable"
              style={{ textAlign: "left", cursor: "pointer" }}
              onClick={() => openItem(it)}
            >
              <div className="archiveRow">
                <div className="thumbStack">
                  {img1 ? <img className="thumb t1" src={img1} alt="" loading="lazy" decoding="async" /> : <div className="thumb t1 shimmer" />}
                  {img2 ? <img className="thumb t2" src={img2} alt="" loading="lazy" decoding="async" /> : <div className="thumb t2 shimmer" />}
                  {img3 ? <img className="thumb t3" src={img3} alt="" loading="lazy" decoding="async" /> : <div className="thumb t3 shimmer" />}
                </div>

                <div className="archiveMain">
                  <div className="archiveTitle">{t}</div>
                  <div className="archiveMeta">{safeDate(it.ts)}</div>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <Modal
        open={open}
        title={
          picked?.kind === "wheel"
            ? "Колесо фортуны"
            : picked?.kind === "spread"
            ? spreadTitle(picked.s)
            : "Архив"
        }
        onClose={() => setOpen(false)}
      >
        {!picked ? (
          <p className="text">…</p>
        ) : picked.kind === "wheel" ? (
          (() => {
            const c = wheelCardOf(picked.w);
            if (!c) return <p className="text">Не удалось прочитать запись.</p>;
            const title = wheelTitle(c);

            return (
              <div className="row">
                <img className="img" src={c.image} alt={title} loading="lazy" decoding="async" />
                <div className="col">
                  <div className="title" style={{ fontSize: 16 }}>{title}</div>
                  <p className="text" style={{ marginTop: 6 }}>{c.meaningRu}</p>

                  {/* ✅ ВОТ ТУТ выделение совета для колеса в архиве */}
                  <div className="adviceBox" style={{ marginTop: 12 }}>
                    <div className="adviceTitle">Совет</div>
                    <div className="adviceText">{c.adviceRu}</div>
                  </div>
                </div>
              </div>
            );
          })()
        ) : (
          <SpreadReveal
            cards={(picked.s as any).cards ?? []}
            positions={(picked.s as any).positions ?? []}
            interpretation={String((picked.s as any).interpretation ?? "")}
            resetToken={resetToken}
          />
        )}
      </Modal>
    </AppShell>
  );
}
