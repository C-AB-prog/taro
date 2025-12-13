"use client";

import { useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { RitualHeader } from "@/components/RitualHeader";
import { SpreadReveal } from "@/components/SpreadReveal";

type SpreadDef = {
  id: string;
  title: string;
  price: number;
  cardsCount: number;
  brief: string;
  positions: string[];
  tag: "general" | "love" | "money" | "health";
};

type View = {
  title: string;
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
  // ✅ FIX: реально 6 карт
  {
    id: "my_health",
    title: "Моё здоровье",
    price: 550,
    cardsCount: 6,
    tag: "health",
    brief: "Самодиагностика: состояние, что истощает, что поддержит и рекомендация.",
    positions: ["Текущее состояние", "Физика", "Эмоции", "Что истощает", "Что поддержит", "Рекомендация"],
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

async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit, ms: number) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(input, { ...init, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

async function postJSON(url: string, body: any, timeoutMs = 6000) {
  const initData = getInitData();
  const r = await fetchWithTimeout(
    url,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-telegram-init-data": initData,
        "x-telegram-webapp-init-data": initData,
      },
      body: JSON.stringify({ ...(body ?? {}), initData }),
      cache: "no-store",
    },
    timeoutMs
  );
  const data = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, data };
}

async function getJSON(url: string, timeoutMs = 6000) {
  const initData = getInitData();
  const r = await fetchWithTimeout(
    url,
    {
      method: "GET",
      headers: {
        "x-telegram-init-data": initData,
        "x-telegram-webapp-init-data": initData,
      },
      cache: "no-store",
    },
    timeoutMs
  );
  const data = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, data };
}

function toTime(ts: string) {
  const t = new Date(ts || 0).getTime();
  return Number.isFinite(t) ? t : 0;
}

async function fetchLatestSpreadFromArchive(preferTitle: string, startedAtMs: number): Promise<ArchiveSpreadItem | null> {
  const r = await getJSON("/api/archive", 6000);
  if (!r.ok) return null;

  const spreads: ArchiveSpreadItem[] =
    r.data?.spreads ?? r.data?.spreadPurchases ?? r.data?.purchases ?? [];

  if (!Array.isArray(spreads) || spreads.length === 0) return null;

  const sorted = spreads
    .slice()
    .sort((a, b) => toTime(String(b.createdAt ?? b.date ?? "")) - toTime(String(a.createdAt ?? a.date ?? "")));

  const fresh = sorted.find((s) => {
    const t = toTime(String(s.createdAt ?? s.date ?? ""));
    const name = (s.spreadTitle || s.title || "").trim();
    return name === preferTitle.trim() && t >= startedAtMs - 7000;
  });
  if (fresh) return fresh;

  const any = sorted.find((s) => (s.spreadTitle || s.title || "").trim() === preferTitle.trim());
  if (any) return any;

  return sorted[0] ?? null;
}

function extractView(resData: any, fallbackPositions: string[]) {
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

function keyVariants(def: SpreadDef) {
  const base = def.id; // couple_future
  const kebab = base.replace(/_/g, "-");
  const compact = base.replace(/[-_]/g, "");
  const camel = base.replace(/_([a-z])/g, (_, ch) => String(ch).toUpperCase());

  const extra: string[] = [];

  if (def.id === "couple_future") {
    extra.push(
      "future_pair",
      "future-pair",
      "futurePair",
      "coupleFuture",
      "Будущее пары"
    );
  }
  if (def.id === "three") extra.push("three_cards", "three-cards", "Три карты");
  if (def.id === "aibolit") extra.push("doctor_aibolit", "doctor-aibolit", "Доктор Айболит");
  if (def.id === "celtic_cross") extra.push("celtic-cross", "celticcross", "Кельтский крест");
  if (def.id === "station_for_two") extra.push("station-for-two", "Вокзал для двоих");
  if (def.id === "money_tree") extra.push("money-tree", "Денежное дерево");
  if (def.id === "money_on_barrel") extra.push("money-on-barrel", "Деньги на бочку");
  if (def.id === "my_health") extra.push("my-health", "Моё здоровье");

  return Array.from(new Set([base, kebab, compact, camel, def.title, ...extra].filter(Boolean)));
}

function looksLikeUnknown(d: any) {
  const s = String(d?.error ?? d?.message ?? "").toLowerCase();
  return s.includes("unknown") || s.includes("not found") || s.includes("spread") || s.includes("не найден");
}

function prettyErr(d: any) {
  const msg = d?.message ?? d?.error ?? d;
  if (typeof msg === "string") return msg;
  return "Покупка не прошла. Сервер отклонил запрос.";
}

export default function SpreadsPage() {
  const [busyId, setBusyId] = useState<string | null>(null);

  const [view, setView] = useState<View | null>(null);

  const [errText, setErrText] = useState<string | null>(null);
  const [errDebug, setErrDebug] = useState<string>("");

  const [filter, setFilter] = useState<"all" | "general" | "love" | "money" | "health">("all");

  const list = useMemo(() => {
    if (filter === "all") return SPREADS;
    return SPREADS.filter((s) => s.tag === filter);
  }, [filter]);

  async function buy(def: SpreadDef) {
    if (busyId) return;
    setBusyId(def.id);
    setErrText(null);
    setErrDebug("");

    const startedAt = Date.now();

    try {
      const keys = keyVariants(def);

      // будем пробовать оба эндпойнта и разные ключи тела запроса
      const endpoints = ["/api/spreads/buy", "/api/spreads/purchase"];
      const bodiesForKey = (k: string) => [
        { spreadId: k },
        { id: k },
        { spreadKey: k },
        { slug: k },
        { key: k },
      ];

      let last: { ok: boolean; status: number; data: any } | null = null;

      // ограничим попытки, чтобы не “молчать” долго
      let attempts = 0;
      const MAX = 18;

      for (const ep of endpoints) {
        for (const k of keys) {
          for (const body of bodiesForKey(k)) {
            attempts++;
            if (attempts > MAX) break;

            try {
              const r = await postJSON(ep, body, 6000);
              last = r;

              if (r.ok) break;

              // если это “не тот ключ” — идём дальше
              if (r.status === 404 || looksLikeUnknown(r.data)) continue;

              // остальные ошибки (баланс/валидация) — стоп
              break;
            } catch (e: any) {
              last = { ok: false, status: 0, data: { error: "TIMEOUT_OR_NETWORK", message: String(e?.name ?? e) } };
            }
          }
          if (last?.ok || attempts > MAX) break;
        }
        if (last?.ok || attempts > MAX) break;
      }

      if (!last || !last.ok) {
        // возможно списало, но ответ не пришёл — подхватим из архива
        const arch = await fetchLatestSpreadFromArchive(def.title, startedAt);
        if (arch?.cards?.length) {
          setView({
            title: def.title,
            cards: arch.cards!,
            positions: (arch.positions ?? def.positions) as string[],
            interpretation: String(arch.interpretation ?? ""),
            resetToken: `${def.id}-arch-${Date.now()}`,
          });
          // скролл к результату
          setTimeout(() => document.getElementById("spreadResult")?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
          return;
        }

        setErrText(prettyErr(last?.data));
        setErrDebug(last ? JSON.stringify(last.data, null, 2) : "");
        return;
      }

      const extracted = extractView(last.data, def.positions);

      if (Array.isArray(extracted.cards) && extracted.cards.length > 0) {
        setView({
          title: def.title,
          cards: extracted.cards,
          positions: extracted.positions ?? def.positions,
          interpretation: extracted.interpretation ?? "",
          resetToken: `${def.id}-${Date.now()}`,
        });
        setTimeout(() => document.getElementById("spreadResult")?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
        return;
      }

      // ответ пустой — подождём архив немного
      for (let i = 0; i < 6; i++) {
        const arch = await fetchLatestSpreadFromArchive(def.title, startedAt);
        if (arch?.cards?.length) {
          setView({
            title: def.title,
            cards: arch.cards!,
            positions: (arch.positions ?? def.positions) as string[],
            interpretation: String(arch.interpretation ?? ""),
            resetToken: `${def.id}-arch-${Date.now()}`,
          });
          setTimeout(() => document.getElementById("spreadResult")?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
          return;
        }
        await new Promise((res) => setTimeout(res, 700));
      }

      setErrText("Покупка прошла, но карты/трактовка не пришли. Обычно запись появляется в Архиве.");
      setErrDebug(JSON.stringify({ buyResponse: last.data }, null, 2));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <AppShell>
      <RitualHeader label="Расклады" />

      <div className="card">
        <div className="segRow">
          <button className={`segBtn ${filter === "all" ? "segBtnActive" : ""}`} onClick={() => setFilter("all")}>Все</button>
          <button className={`segBtn ${filter === "general" ? "segBtnActive" : ""}`} onClick={() => setFilter("general")}>Ситуация</button>
          <button className={`segBtn ${filter === "love" ? "segBtnActive" : ""}`} onClick={() => setFilter("love")}>Отношения</button>
          <button className={`segBtn ${filter === "money" ? "segBtnActive" : ""}`} onClick={() => setFilter("money")}>Финансы</button>
          <button className={`segBtn ${filter === "health" ? "segBtnActive" : ""}`} onClick={() => setFilter("health")}>Здоровье</button>
        </div>
      </div>

      <div style={{ height: 12 }} />

      {errText ? (
        <div className="card">
          <div className="title">Не получилось</div>
          <div className="small" style={{ marginTop: 6, whiteSpace: "pre-wrap" }}>{errText}</div>
          {errDebug ? (
            <details style={{ marginTop: 10 }}>
              <summary className="small" style={{ cursor: "pointer" }}>Показать детали</summary>
              <pre className="small" style={{ whiteSpace: "pre-wrap", margin: 0, marginTop: 8 }}>{errDebug}</pre>
            </details>
          ) : null}
          <div style={{ height: 10 }} />
          <button className="btn btnGhost" style={{ width: "100%" }} onClick={() => { setErrText(null); setErrDebug(""); }}>
            Закрыть
          </button>
        </div>
      ) : null}

      {view ? (
        <div id="spreadResult" className="card" style={{ marginTop: 12 }}>
          <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline" }}>
            <div className="title">{view.title}</div>
            <button className="btn btnGhost" style={{ padding: "8px 10px" }} onClick={() => setView(null)}>
              Свернуть
            </button>
          </div>

          <div style={{ height: 10 }} />

          {/* Важно для “сенсора”: даём нормальный тач-скролл */}
          <div style={{ touchAction: "pan-y" }}>
            <SpreadReveal
              cards={view.cards}
              positions={view.positions}
              interpretation={view.interpretation}
              resetToken={view.resetToken}
            />
          </div>
        </div>
      ) : null}

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
    </AppShell>
  );
}
