"use client";

import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { RitualHeader } from "@/components/RitualHeader";
import { SpreadReveal } from "@/components/SpreadReveal";
import { ruTitleFromSlug } from "@/lib/ruTitles";

type WheelCard = { slug?: string; titleRu?: string; meaningRu: string; adviceRu: string; image: string };

type WheelItemAny = any;
type SpreadItemAny = any;

type Item =
  | { kind: "spread"; ts: string; s: SpreadItemAny }
  | { kind: "wheel"; ts: string; w: WheelItemAny };

function fmtDate(ts: string) {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return ts;
  return d.toLocaleDateString("ru-RU", { day: "2-digit", month: "long", year: "numeric" });
}

function fmtTime(ts: string) {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
}

function pickTs(x: any) {
  return String(x?.createdAt ?? x?.date ?? x?.ts ?? "");
}

function toWheelCard(w: any): WheelCard | null {
  const c = w?.card ?? w;
  const image = c?.image ?? w?.image;
  const meaningRu = c?.meaningRu ?? w?.meaningRu;
  const adviceRu = c?.adviceRu ?? w?.adviceRu;
  const slug = c?.slug ?? w?.slug;
  const titleRu = c?.titleRu ?? w?.titleRu;
  if (!image || !meaningRu || !adviceRu) return null;
  return { image: String(image), meaningRu: String(meaningRu), adviceRu: String(adviceRu), slug, titleRu };
}

function wheelTitle(c: WheelCard) {
  return c.slug ? ruTitleFromSlug(c.slug) : (c.titleRu ?? "Карта");
}

export default function ArchivePage() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);

  const [filter, setFilter] = useState<"all" | "spreads" | "wheel">("all");
  const [openKey, setOpenKey] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const r = await fetch("/api/archive", { cache: "no-store" });
        const d = await r.json().catch(() => ({}));
        setData(d);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const items: Item[] = useMemo(() => {
    const spreads: SpreadItemAny[] = data?.spreads ?? data?.spreadPurchases ?? data?.purchases ?? [];
    const wheel: WheelItemAny[] = data?.wheel ?? data?.wheelSpins ?? data?.wheelItems ?? [];

    const res: Item[] = [];

    for (const s of (Array.isArray(spreads) ? spreads : [])) {
      res.push({ kind: "spread", ts: pickTs(s), s });
    }
    for (const w of (Array.isArray(wheel) ? wheel : [])) {
      res.push({ kind: "wheel", ts: pickTs(w), w });
    }

    res.sort((a, b) => {
      const ta = new Date(a.ts).getTime() || 0;
      const tb = new Date(b.ts).getTime() || 0;
      if (tb !== ta) return tb - ta;
      // при равных — расклады выше колеса
      if (a.kind === b.kind) return 0;
      return a.kind === "spread" ? -1 : 1;
    });

    if (filter === "spreads") return res.filter((x) => x.kind === "spread");
    if (filter === "wheel") return res.filter((x) => x.kind === "wheel");
    return res;
  }, [data, filter]);

  return (
    <AppShell>
      <RitualHeader label="Архив" />

      <div className="card">
        <div className="segRow segRowEqual">
          <button className={`segBtn ${filter === "all" ? "segBtnActive" : ""}`} onClick={() => setFilter("all")}>Все</button>
          <button className={`segBtn ${filter === "spreads" ? "segBtnActive" : ""}`} onClick={() => setFilter("spreads")}>Расклады</button>
          <button className={`segBtn ${filter === "wheel" ? "segBtnActive" : ""}`} onClick={() => setFilter("wheel")}>Колесо</button>
        </div>

        <div className="small" style={{ marginTop: 10 }}>
          Здесь хранятся все спины колеса и купленные расклады. Записи неизменны.
        </div>
      </div>

      <div style={{ height: 12 }} />

      {loading ? (
        <div className="card">
          <div className="shimmer" style={{ height: 16, width: "55%" }} />
          <div style={{ height: 10 }} />
          <div className="shimmer" style={{ height: 12, width: "85%" }} />
        </div>
      ) : null}

      {!loading && items.length === 0 ? (
        <div className="card">
          <div className="title">Пока пусто</div>
          <div className="small" style={{ marginTop: 6 }}>Сделай расклад или прокрути колесо — и записи появятся здесь.</div>
        </div>
      ) : null}

      <div className="archiveList">
        {items.map((it, idx) => {
          const key = `${it.kind}-${it.ts}-${idx}`;
          const isOpen = openKey === key;

          if (it.kind === "spread") {
            const s = it.s;
            const title = String(s?.spreadTitle ?? s?.title ?? "Расклад");
            const ts = pickTs(s);
            const cards = (s?.cards ?? []) as { slug: string; image: string }[];
            const positions = (s?.positions ?? []) as string[];
            const interpretation = String(s?.interpretation ?? "");

            return (
              <div key={key} className="card archiveItem pressable" onClick={() => setOpenKey(isOpen ? null : key)} role="button">
                <div className="archiveRow">
                  <div className="thumbStack" aria-hidden="true">
                    {cards?.[0]?.image ? <img className="thumb t1" src={cards[0].image} alt="" /> : null}
                    {cards?.[1]?.image ? <img className="thumb t2" src={cards[1].image} alt="" /> : null}
                    {cards?.[2]?.image ? <img className="thumb t3" src={cards[2].image} alt="" /> : null}
                  </div>
                  <div className="archiveMain">
                    <div className="archiveTitle">{title}</div>
                    <div className="archiveMeta">{fmtDate(ts)} {fmtTime(ts) ? `• ${fmtTime(ts)}` : ""}</div>
                  </div>
                </div>

                {isOpen ? (
                  <div style={{ marginTop: 12, touchAction: "pan-y" }}>
                    <SpreadReveal
                      cards={cards}
                      positions={positions?.length ? positions : cards.map((_, i) => `Карта ${i + 1}`)}
                      interpretation={interpretation}
                      resetToken={key}
                    />
                  </div>
                ) : null}
              </div>
            );
          }

          // wheel
          const w = it.w;
          const ts = pickTs(w);
          const c = toWheelCard(w);

          return (
            <div key={key} className="card archiveItem pressable" onClick={() => setOpenKey(isOpen ? null : key)} role="button">
              <div className="archiveRow">
                {c?.image ? <img className="thumb" src={c.image} alt="" /> : <div className="thumb" />}
                <div className="archiveMain">
                  <div className="archiveTitle">Колесо фортуны{c ? ` • ${wheelTitle(c)}` : ""}</div>
                  <div className="archiveMeta">{fmtDate(ts)} {fmtTime(ts) ? `• ${fmtTime(ts)}` : ""}</div>
                </div>
              </div>

              {isOpen && c ? (
                <div style={{ marginTop: 12 }}>
                  <div className="row">
                    <img className="img" src={c.image} alt={wheelTitle(c)} loading="lazy" decoding="async" />
                    <div className="col">
                      <div className="title" style={{ fontSize: 16 }}>{wheelTitle(c)}</div>
                      <p className="text" style={{ marginTop: 6 }}>{c.meaningRu}</p>

                      <div className="adviceBox" style={{ marginTop: 12 }}>
                        <div className="adviceTitle">Совет</div>
                        <div className="adviceText">{c.adviceRu}</div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </AppShell>
  );
}
