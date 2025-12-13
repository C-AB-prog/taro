"use client";

import { useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Modal } from "@/components/Modal";
import { RitualHeader } from "@/components/RitualHeader";
import { SpreadReveal } from "@/components/SpreadReveal";

type SpreadDef = {
  id: string; // наш UI-ключ (для перебора вариантов)
  title: string;
  price: number;
  cardsCount: number;
  brief: string;
  positions: string[];
  tag: "general" | "love" | "money" | "health";
};

type View = {
  cards: { slug: string; image: string }[];
  positions: string[];
  interpretation: string;
  resetToken: string;
};

type ArchiveSpreadItem = {
  createdAt?: string;
  date?: string;
  spreadTitle?: string;
  title?: string;
  positions?: string[];
  interpretation?: string;
  cards?: { slug: string; image: string }[];
};

const SPREADS: SpreadDef[] = [
  {
    id: "three",
    title: "Три карты",
    price: 125,
    cardsCount: 3,
    tag: "general",
    brief: "Прошлое • Настоящее • Будущее — быстрый расклад на ситуацию.",
    positions: ["Прошлое", "Настоящее", "Будущее"],
  },
  {
    id: "couple_future",
    title: "Будущее пары",
    price: 125,
    cardsCount: 3,
    tag: "love",
    brief: "Мысли партнёра, что между вами сейчас, и его чувства.",
    positions: ["Мысли партнёра", "Что между вами сейчас", "Чувства партнёра"],
  },
  {
    id: "station_for_two",
    title: "Вокзал для двоих",
    price: 250,
    cardsCount: 2,
    tag: "love",
    brief: "Твои мысли и мысли партнёра — как вы видите отношения.",
    positions: ["Твои мысли", "Мысли партнёра"],
  },
  {
    id: "money_on_barrel",
    title: "Деньги на бочку",
    price: 350,
    cardsCount: 5,
    tag: "money",
    brief: "Отношение к деньгам: траты, установки, что поможет.",
    positions: ["Отношение", "Как трачу", "Что ограничивает", "Что поможет", "Итог"],
  },
  {
    id: "money_tree",
    title: "Денежное дерево",
    price: 450,
    cardsCount: 5,
    tag: "money",
    brief: "Деньги системно: корень, настоящее, помощники, блоки, итог.",
    positions: ["Корень", "Настоящее", "Помощники", "Блоки", "Итог"],
  },
  {
    id: "my_health",
    title: "Моё здоровье",
    price: 550,
    cardsCount: 7,
    tag: "health",
    brief: "Самодиагностика: что влияет, что поддержит, тенденция.",
    positions: ["S", "Физика", "Эмоции", "Что истощает", "Что поддержит", "Рекомендация", "Тенденция"],
  },
  {
    id: "aibolit",
    title: "Доктор Айболит",
    price: 800,
    cardsCount: 9,
    tag: "health",
    brief: "Комплексный взгляд на здоровье: поддержка, уязвимости, фокус.",
    positions: ["1", "2", "3", "4", "5", "6", "7", "8", "9"],
  },
  {
    id: "celtic_cross",
    title: "Кельтский крест",
    price: 1500,
    cardsCount: 10,
    tag: "general",
    brief: "Глубоко: причины, скрытые влияния, развитие, исход.",
    positions: ["1","2","3","4","5","6","7","8","9","10"],
  },
];

function tagLabel(tag: SpreadDef["tag"]) {
  if (tag === "love") return "Отношения";
  if (tag === "money") return "Финансы";
  if (tag === "health") return "Здоровье";
  return "Ситуация";
}

function getInitData() {
  return (globalThis as any)?.Telegram?.WebApp?.initData
    ? String((globalThis as any).Telegram.WebApp.initData)
    : "";
}

async function postJSON(url: string, body: any) {
  const initData = getInitData();
  const r = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-telegram-init-data": initData,
      "x-telegram-webapp-init-data": initData,
    },
    body: JSON.stringify({ ...(body ?? {}), initData }),
    cache: "no-store",
  });
  const data = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, data };
}

async function getJSON(url: string) {
  const initData = getInitData();
  const r = await fetch(url, {
    method: "GET",
    headers: {
      "x-telegram-init-data": initData,
      "x-telegram-webapp-init-data": initData,
    },
    cache: "no-store",
  });
  const data = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, data };
}

function idVariants(def: SpreadDef) {
  const base = def.id;
  const kebab = base.replace(/_/g, "-");
  const snake = base.replace(/-/g, "_");
  const compact = base.replace(/[-_]/g, "");
  const ru = def.title;

  const aliases: string[] = [];
  if (def.title === "Три карты") aliases.push("three_cards", "three-cards", "threecards");
  if (def.title === "Кельтский крест") aliases.push("celtic", "celticcross", "celtic-cross");
  if (def.title === "Доктор Айболит") aliases.push("doctor_aibolit", "doctor-aibolit", "doctor");

  return Array.from(new Set([base, kebab, snake, compact, ...aliases, ru].filter(Boolean)));
}

function extractViewFromBuyResponse(resData: any, fallbackPositions: string[]) {
  const cards =
    (resData?.cards ??
      resData?.result?.cards ??
      resData?.purchase?.cards ??
      resData?.data?.cards ??
      []) as { slug: string; image: string }[];

  const interpretation = String(
    resData?.interpretation ??
      resData?.result?.interpretation ??
      resData?.purchase?.interpretation ??
      resData?.data?.interpretation ??
      ""
  );

  const positions =
    (resData?.positions ??
      resData?.result?.positions ??
      resData?.purchase?.positions ??
      fallbackPositions) as string[];

  return { cards, positions, interpretation };
}

function toTime(ts: string) {
  const t = new Date(ts || 0).getTime();
  return Number.isFinite(t) ? t : 0;
}

async function fetchLatestSpreadFromArchive(preferTitle?: string): Promise<ArchiveSpreadItem | null> {
  const r = await getJSON("/api/archive");
  if (!r.ok) return null;

  const spreads: ArchiveSpreadItem[] =
    r.data?.spreads ?? r.data?.spreadPurchases ?? r.data?.purchases ?? [];

  if (!Array.isArray(spreads) || spreads.length === 0) return null;

  // сортируем по времени
  const sorted = spreads
    .slice()
    .sort((a, b) => {
      const ta = toTime(String(a.createdAt ?? a.date ?? ""));
      const tb = toTime(String(b.createdAt ?? b.date ?? ""));
      return tb - ta;
    });

  if (preferTitle) {
    const found = sorted.find((s) => (s.spreadTitle || s.title || "").trim() === preferTitle.trim());
    if (found) return found;
  }

  return sorted[0] ?? null;
}

function prettyErr(d: any) {
  const raw = String(d?.message ?? d?.error ?? d ?? "BUY_FAILED");
  if (raw.toUpperCase() === "BUY_FAILED") return "Покупка не прошла (BUY_FAILED). Сервер отклонил запрос.";
  return raw;
}

export default function SpreadsPage() {
  // совместимо с разными версиями AppShell (с title/без title)
  const Shell = AppShell as any;

  const [open, setOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState("Расклад");
  const [view, setView] = useState<View | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [errOpen, setErrOpen] = useState(false);
  const [errText, setErrText] = useState("");
  const [errDebug, setErrDebug] = useState("");

  const [filter, setFilter] = useState<"all" | "general" | "love" | "money" | "health">("all");

  const list = useMemo(() => {
    if (filter === "all") return SPREADS;
    return SPREADS.filter((s) => s.tag === filter);
  }, [filter]);

  async function buy(def: SpreadDef) {
    if (busyId) return;
    setBusyId(def.id);

    try {
      const variants = idVariants(def);
      let last: { ok: boolean; status: number; data: any } | null = null;

      // 1) пытаемся купить (POST/GET + разные ключи)
      for (const id of variants) {
        const bodies = [
          { spreadId: id },
          { id },
          { spreadKey: id },
          { slug: id },
          { key: id },
        ];

        // POST buy
        for (const b of bodies) {
          const r = await postJSON("/api/spreads/buy", b);
          last = r;
          if (r.ok) break;
          if (r.status === 404) break;
        }
        if (last?.ok) break;

        // POST purchase fallback
        if (last?.status === 404) {
          for (const b of bodies) {
            const r = await postJSON("/api/spreads/purchase", b);
            last = r;
            if (r.ok) break;
            if (r.status === 404) break;
          }
          if (last?.ok) break;
        }

        // GET варианты (если бэк так сделан)
        const qs = encodeURIComponent(id);
        const getTry = [
          `/api/spreads/buy?spreadId=${qs}`,
          `/api/spreads/buy?id=${qs}`,
          `/api/spreads/buy?spreadKey=${qs}`,
          `/api/spreads/purchase?spreadId=${qs}`,
          `/api/spreads/purchase?id=${qs}`,
        ];
        for (const u of getTry) {
          const r = await getJSON(u);
          last = r;
          if (r.ok) break;
        }
        if (last?.ok) break;
      }

      if (!last || !last.ok) {
        setErrText(prettyErr(last?.data));
        setErrDebug(last ? JSON.stringify(last.data, null, 2) : "");
        setErrOpen(true);
        return;
      }

      // 2) пробуем открыть расклад из ответа
      const extracted = extractViewFromBuyResponse(last.data, def.positions);

      if (Array.isArray(extracted.cards) && extracted.cards.length > 0) {
        setView({
          cards: extracted.cards,
          positions: extracted.positions ?? def.positions,
          interpretation: extracted.interpretation ?? "",
          resetToken: `${def.id}-${Date.now()}`,
        });
        setModalTitle(def.title);
        setOpen(true);
        window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred?.("success");
        return;
      }

      // 3) ✅ FALLBACK: покупка прошла, но cards не вернулись -> берём из архива свежую запись
      const latest = await fetchLatestSpreadFromArchive(def.title);

      const aCards = (latest?.cards ?? []) as { slug: string; image: string }[];
      const aInterp = String(latest?.interpretation ?? "");
      const aPos = (latest?.positions ?? def.positions) as string[];

      if (aCards.length > 0) {
        setView({
          cards: aCards,
          positions: aPos,
          interpretation: aInterp,
          resetToken: `${def.id}-arch-${Date.now()}`,
        });
        setModalTitle(def.title);
        setOpen(true);
        window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred?.("success");
        return;
      }

      // 4) если даже в архиве не нашли — говорим прямо
      setErrText(
        "Покупка прошла, но сервер не вернул данные расклада. Открой Архив — запись должна быть там."
      );
      setErrDebug(JSON.stringify({ buyResponse: last.data }, null, 2));
      setErrOpen(true);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Shell title="Расклады">
      <h1 className="h1">Расклады</h1>
      <RitualHeader label="Выбери формат" />

      <div className="card">
        <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div className="title">Категории</div>
            <div className="small">Короткое описание каждого расклада</div>
          </div>
          <div className="badge" style={{ padding: "8px 12px" }}>{list.length}</div>
        </div>

        <div style={{ height: 10 }} />

        <div className="segRow">
          <button className={`segBtn ${filter === "all" ? "segBtnActive" : ""}`} onClick={() => setFilter("all")}>
            Все
          </button>
          <button className={`segBtn ${filter === "general" ? "segBtnActive" : ""}`} onClick={() => setFilter("general")}>
            Ситуация
          </button>
          <button className={`segBtn ${filter === "love" ? "segBtnActive" : ""}`} onClick={() => setFilter("love")}>
            Отношения
          </button>
          <button className={`segBtn ${filter === "money" ? "segBtnActive" : ""}`} onClick={() => setFilter("money")}>
            Финансы
          </button>
          <button className={`segBtn ${filter === "health" ? "segBtnActive" : ""}`} onClick={() => setFilter("health")}>
            Здоровье
          </button>
        </div>
      </div>

      <div style={{ height: 12 }} />

      <div className="spreadList">
        {list.map((s) => (
          <div key={s.id} className="card spreadCard pressable" style={{ padding: 14 }}>
            <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline" }}>
              <div className="title">{s.title}</div>
              <div className="spreadPrice">{s.price}</div>
            </div>

            <div className="small" style={{ marginTop: 6 }}>
              <span className="spreadTag">{tagLabel(s.tag)}</span>
              <span style={{ marginLeft: 10 }}>{s.cardsCount} карт</span>
            </div>

            <div className="small" style={{ marginTop: 8 }}>{s.brief}</div>

            <div style={{ height: 10 }} />

            <button
              className={`btn ${busyId === s.id ? "btnGhost" : "btnPrimary"}`}
              style={{ width: "100%" }}
              onClick={() => buy(s)}
              disabled={!!busyId}
            >
              {busyId === s.id ? "Готовлю…" : "Сделать расклад"}
            </button>
          </div>
        ))}
      </div>

      <Modal open={open} title={modalTitle} onClose={() => setOpen(false)}>
        {!view ? (
          <p className="text">…</p>
        ) : (
          <SpreadReveal
            cards={view.cards}
            positions={view.positions}
            interpretation={view.interpretation}
            resetToken={view.resetToken}
          />
        )}
      </Modal>

      <Modal open={errOpen} title="Не получилось" onClose={() => setErrOpen(false)}>
        <p className="text" style={{ whiteSpace: "pre-wrap" }}>{errText}</p>

        {errDebug ? (
          <>
            <div style={{ height: 10 }} />
            <div className="card" style={{ padding: 12 }}>
              <div className="small" style={{ whiteSpace: "pre-wrap" }}>{errDebug}</div>
            </div>
          </>
        ) : null}

        <div style={{ height: 12 }} />
        <button className="btn btnGhost" style={{ width: "100%" }} onClick={() => setErrOpen(false)}>
          Ок
        </button>
      </Modal>
    </Shell>
  );
}
