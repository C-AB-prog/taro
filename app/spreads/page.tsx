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
  savedToArchive?: boolean;
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

async function postJSON(url: string, body: any, timeoutMs = 6500) {
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

async function getJSON(url: string, timeoutMs = 6500) {
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

function hasPurchaseMarker(d: any) {
  return Boolean(
    d?.purchase?.id ||
    d?.purchaseId ||
    d?.id ||
    d?.result?.id ||
    d?.success === true ||
    d?.ok === true
  );
}

function looksLikeErrorPayload(d: any) {
  // даже если HTTP 200, сервер может вернуть { error: "..."} или { ok:false }
  if (d?.ok === false || d?.success === false) return true;
  const s = String(d?.error ?? d?.message ?? "").toLowerCase();
  if (!s) return false;
  return (
    s.includes("unknown") ||
    s.includes("not found") ||
    s.includes("не найден") ||
    s.includes("invalid") ||
    s.includes("unauthorized") ||
    s.includes("forbidden")
  );
}

function keyVariants(def: SpreadDef) {
  const base = def.id;
  const kebab = base.replace(/_/g, "-");
  const compact = base.replace(/[-_]/g, "");
  const camel = base.replace(/_([a-z])/g, (_, ch) => String(ch).toUpperCase());

  const extra: string[] = [];
  if (def.id === "couple_future") extra.push("future_pair", "futurePair", "coupleFuture", "Будущее пары");
  if (def.id === "three") extra.push("three_cards", "three-cards", "Три карты");
  if (def.id === "station_for_two") extra.push("station-for-two", "Вокзал для двоих");
  if (def.id === "money_tree") extra.push("money-tree", "Денежное дерево");
  if (def.id === "money_on_barrel") extra.push("money-on-barrel", "Деньги на бочку");
  if (def.id === "my_health") extra.push("my-health", "Моё здоровье");
  if (def.id === "aibolit") extra.push("doctor_aibolit", "doctor-aibolit", "Доктор Айболит");
  if (def.id === "celtic_cross") extra.push("celtic-cross", "celticcross", "Кельтский крест");

  return Array.from(new Set([base, kebab, compact, camel, def.title, ...extra].filter(Boolean)));
}

async function findInArchiveExact(title: string, startedAtMs: number) {
  const r = await getJSON("/api/archive", 6500);
  if (!r.ok) return null;

  const spreads: ArchiveSpreadItem[] =
    r.data?.spreads ?? r.data?.spreadPurchases ?? r.data?.purchases ?? [];

  if (!Array.isArray(spreads)) return null;

  const sorted = spreads
    .slice()
    .sort((a, b) => toTime(String(b.createdAt ?? b.date ?? "")) - toTime(String(a.createdAt ?? a.date ?? "")));

  // строго только этот расклад
  const found = sorted.find((s) => {
    const t = toTime(String(s.createdAt ?? s.date ?? ""));
    const name = (s.spreadTitle || s.title || "").trim();
    return name === title.trim() && t >= startedAtMs - 8000;
  });

  return found ?? null;
}

export default function SpreadsPage() {
  const [filter, setFilter] = useState<"all" | "general" | "love" | "money" | "health">("all");

  const [busyId, setBusyId] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  const [views, setViews] = useState<Record<string, View | null>>({});
  const [errs, setErrs] = useState<Record<string, { text: string; debug?: string } | null>>({});

  const list = useMemo(() => {
    const base = filter === "all" ? SPREADS : SPREADS.filter((s) => s.tag === filter);
    return base;
  }, [filter]);

  async function buy(def: SpreadDef) {
    if (busyId) return;

    setOpenId(def.id);
    setBusyId(def.id);
    setErrs((m) => ({ ...m, [def.id]: null }));

    const startedAt = Date.now();

    try {
      const keys = keyVariants(def);
      const endpoints = ["/api/spreads/buy", "/api/spreads/purchase"];
      const bodiesForKey = (k: string) => [
        { spreadId: k },
        { id: k },
        { spreadKey: k },
        { slug: k },
        { key: k },
      ];

      let last: { ok: boolean; status: number; data: any; ep?: string; body?: any } | null = null;

      let attempts = 0;
      const MAX = 16;

      outer: for (const ep of endpoints) {
        for (const k of keys) {
          for (const body of bodiesForKey(k)) {
            attempts++;
            if (attempts > MAX) break outer;

            const r = await postJSON(ep, body, 6500);
            last = { ...r, ep, body };

            // успех по HTTP
            if (r.ok) {
              const extracted = extractView(r.data, def.positions);

              // ✅ реально успех — сервер вернул карты
              if (Array.isArray(extracted.cards) && extracted.cards.length > 0 && !looksLikeErrorPayload(r.data)) {
                setViews((m) => ({
                  ...m,
                  [def.id]: {
                    title: def.title,
                    cards: extracted.cards,
                    positions: extracted.positions ?? def.positions,
                    interpretation: extracted.interpretation ?? "",
                    resetToken: `${def.id}-${Date.now()}`,
                    savedToArchive: true, // проверим ниже, но пометим оптимистично
                  },
                }));
                // проверим архив (чтобы не было “показал, но не сохранил”)
                for (let i = 0; i < 6; i++) {
                  const found = await findInArchiveExact(def.title, startedAt);
                  if (found?.cards?.length) {
                    setViews((m) => ({
                      ...m,
                      [def.id]: {
                        title: def.title,
                        cards: found.cards!,
                        positions: (found.positions ?? def.positions) as string[],
                        interpretation: String(found.interpretation ?? ""),
                        resetToken: `${def.id}-arch-${Date.now()}`,
                        savedToArchive: true,
                      },
                    }));
                    return;
                  }
                  await new Promise((res) => setTimeout(res, 650));
                }
                // если не нашли — значит сервер не сохранил, отметим это
                setViews((m) => ({
                  ...m,
                  [def.id]: m[def.id] ? { ...m[def.id]!, savedToArchive: false } : m[def.id],
                }));
                return;
              }

              // ✅ сервер мог вернуть purchaseId без карт — тогда ждём архив
              if (hasPurchaseMarker(r.data) && !looksLikeErrorPayload(r.data)) {
                for (let i = 0; i < 8; i++) {
                  const found = await findInArchiveExact(def.title, startedAt);
                  if (found?.cards?.length) {
                    setViews((m) => ({
                      ...m,
                      [def.id]: {
                        title: def.title,
                        cards: found.cards!,
                        positions: (found.positions ?? def.positions) as string[],
                        interpretation: String(found.interpretation ?? ""),
                        resetToken: `${def.id}-arch-${Date.now()}`,
                        savedToArchive: true,
                      },
                    }));
                    return;
                  }
                  await new Promise((res) => setTimeout(res, 650));
                }

                setErrs((m) => ({
                  ...m,
                  [def.id]: {
                    text: "Покупка прошла, но запись не появилась в архиве. Значит сервер не сохранил покупку.",
                    debug: JSON.stringify({ response: r.data, ep, body }, null, 2),
                  },
                }));
                return;
              }

              // HTTP 200, но внутри ошибка/unknown — пробуем следующий ключ
              if (looksLikeErrorPayload(r.data)) continue;

              // иначе — тоже пробуем дальше
              continue;
            }

            // не ok: если 404/unknown — идём дальше, иначе стоп
            const s = String(r.data?.error ?? r.data?.message ?? "").toLowerCase();
            const isUnknown = r.status === 404 || s.includes("unknown") || s.includes("not found") || s.includes("не найден");
            if (isUnknown) continue;

            break outer;
          }
        }
      }

      setErrs((m) => ({
        ...m,
        [def.id]: {
          text: String(last?.data?.message ?? last?.data?.error ?? "Покупка не прошла. Сервер отклонил запрос."),
          debug: last ? JSON.stringify(last, null, 2) : "",
        },
      }));
    } catch (e: any) {
      setErrs((m) => ({
        ...m,
        [def.id]: { text: "Сеть шалит. Попробуй ещё раз.", debug: String(e?.name ?? e) },
      }));
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

      <div className="spreadList">
        {list.map((s) => {
          const isBusy = busyId === s.id;
          const isOpen = openId === s.id;
          const v = views[s.id] ?? null;
          const err = errs[s.id] ?? null;

          return (
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

              <div className="row" style={{ gap: 10 }}>
                <button
                  className={`btn ${isBusy ? "btnGhost" : "btnPrimary"}`}
                  style={{ flex: 1 }}
                  onClick={() => buy(s)}
                  disabled={!!busyId}
                >
                  {isBusy ? "Готовлю…" : "Сделать расклад"}
                </button>

                {(isOpen && (v || err)) ? (
                  <button
                    className="btn btnGhost"
                    style={{ padding: "12px 12px" }}
                    onClick={() => setOpenId(null)}
                  >
                    Свернуть
                  </button>
                ) : (
                  <button
                    className="btn btnGhost"
                    style={{ padding: "12px 12px" }}
                    onClick={() => setOpenId(s.id)}
                  >
                    Открыть
                  </button>
                )}
              </div>

              {/* Результат — прямо в этой карточке */}
              {isOpen && v ? (
                <div style={{ marginTop: 12, touchAction: "pan-y" }}>
                  {v.savedToArchive === false ? (
                    <div className="small" style={{ marginBottom: 10 }}>
                      ⚠️ Сервер показал расклад, но в архив его не записал (значит покупка не сохранилась).
                    </div>
                  ) : null}

                  <SpreadReveal
                    cards={v.cards}
                    positions={v.positions}
                    interpretation={v.interpretation}
                    resetToken={v.resetToken}
                  />
                </div>
              ) : null}

              {isOpen && err ? (
                <div className="card" style={{ marginTop: 12, padding: 12 }}>
                  <div className="title" style={{ fontSize: 14 }}>Не получилось</div>
                  <div className="small" style={{ marginTop: 6, whiteSpace: "pre-wrap" }}>{err.text}</div>
                  {err.debug ? (
                    <details style={{ marginTop: 10 }}>
                      <summary className="small" style={{ cursor: "pointer" }}>Показать детали</summary>
                      <pre className="small" style={{ whiteSpace: "pre-wrap", margin: 0, marginTop: 8 }}>{err.debug}</pre>
                    </details>
                  ) : null}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </AppShell>
  );
}
