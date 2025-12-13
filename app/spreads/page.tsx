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

type Err = { text: string; debug?: string };

const SPREADS: SpreadDef[] = [
  { id: "three", title: "Три карты", price: 125, cardsCount: 3, tag: "general",
    brief: "Прошлое • Настоящее • Будущее — быстрый расклад на ситуацию.",
    positions: ["Прошлое", "Настоящее", "Будущее"],
  },
  { id: "couple_future", title: "Будущее пары", price: 125, cardsCount: 3, tag: "love",
    brief: "Мысли партнёра, что между вами сейчас, и его чувства.",
    positions: ["Мысли партнёра", "Что между вами сейчас", "Чувства партнёра"],
  },
  { id: "station_for_two", title: "Вокзал для двоих", price: 250, cardsCount: 2, tag: "love",
    brief: "Твои мысли и мысли партнёра — как вы видите отношения.",
    positions: ["Твои мысли", "Мысли партнёра"],
  },
  { id: "money_on_barrel", title: "Деньги на бочку", price: 350, cardsCount: 5, tag: "money",
    brief: "Отношение к деньгам: траты, установки, что поможет.",
    positions: ["Отношение", "Как трачу", "Что ограничивает", "Что поможет", "Итог"],
  },
  { id: "money_tree", title: "Денежное дерево", price: 450, cardsCount: 5, tag: "money",
    brief: "Деньги системно: корень, настоящее, помощники, блоки, итог.",
    positions: ["Корень", "Настоящее", "Помощники", "Блоки", "Итог"],
  },
  { id: "my_health", title: "Моё здоровье", price: 550, cardsCount: 6, tag: "health",
    brief: "Самодиагностика: состояние, что истощает, что поддержит и рекомендация.",
    positions: ["Текущее состояние", "Физика", "Эмоции", "Что истощает", "Что поддержит", "Рекомендация"],
  },
  { id: "aibolit", title: "Доктор Айболит", price: 800, cardsCount: 9, tag: "health",
    brief: "Комплексный взгляд на здоровье: поддержка, уязвимости, фокус.",
    positions: ["1","2","3","4","5","6","7","8","9"],
  },
  { id: "celtic_cross", title: "Кельтский крест", price: 1500, cardsCount: 10, tag: "general",
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

async function postJSON(url: string, body: any, timeoutMs = 6500) {
  const initData = getInitData();
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);

  try {
    const r = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-telegram-init-data": initData,
        "x-telegram-webapp-init-data": initData,
      },
      body: JSON.stringify({ ...(body ?? {}), initData }),
      cache: "no-store",
      signal: ctrl.signal,
    });

    const data = await r.json().catch(() => ({}));
    return { ok: r.ok, status: r.status, data };
  } finally {
    clearTimeout(t);
  }
}

function extractView(resData: any, fallbackPositions: string[]) {
  // ✅ сервер кладёт в data.view
  const root = resData?.view ?? resData?.result?.view ?? resData?.purchase?.view ?? resData;

  const cards = (root?.cards ?? []) as { slug: string; image: string }[];
  const interpretation = String(root?.interpretation ?? "");
  const positions = (root?.positions ?? fallbackPositions) as string[];
  return { cards, positions, interpretation };
}

function keyVariants(def: SpreadDef) {
  const base = def.id;
  const kebab = base.replace(/_/g, "-");
  const camel = base.replace(/_([a-z])/g, (_, ch) => String(ch).toUpperCase());
  const extra: string[] = [];

  if (def.id === "three") extra.push("three_cards", "three-cards", "Три карты");
  if (def.id === "couple_future") extra.push("future_pair", "futurePair", "coupleFuture", "Будущее пары");
  if (def.id === "station_for_two") extra.push("station-for-two", "Вокзал для двоих");
  if (def.id === "money_tree") extra.push("money-tree", "Денежное дерево");
  if (def.id === "money_on_barrel") extra.push("money-on-barrel", "Деньги на бочку");
  if (def.id === "my_health") extra.push("my-health", "Моё здоровье");
  if (def.id === "aibolit") extra.push("doctor_aibolit", "doctor-aibolit", "Доктор Айболит");
  if (def.id === "celtic_cross") extra.push("celtic-cross", "celticcross", "Кельтский крест");

  return Array.from(new Set([base, kebab, camel, def.title, ...extra].filter(Boolean)));
}

export default function SpreadsPage() {
  const [filter, setFilter] = useState<SpreadDef["tag"] | "all">("all");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  const [views, setViews] = useState<Record<string, View | null>>({});
  const [errs, setErrs] = useState<Record<string, Err | null>>({});

  const list = useMemo(() => {
    return filter === "all" ? SPREADS : SPREADS.filter((s) => s.tag === filter);
  }, [filter]);

  function collapseIfActive(id: string) {
    if (activeId === id) setActiveId(null);
  }

  async function buy(def: SpreadDef) {
    if (busyId) return;

    setBusyId(def.id);
    setActiveId(def.id);
    setErrs((m) => ({ ...m, [def.id]: null }));
    setViews((m) => ({ ...m, [def.id]: null }));

    const keys = keyVariants(def);
    const endpoints = ["/api/spreads/buy", "/api/spreads/purchase"];
    const bodyVariants = (k: string) => [
      { spreadKey: k },
      { spreadId: k },
      { id: k },
      { slug: k },
      { key: k },
    ];

    let last: any = null;

    try {
      outer: for (const ep of endpoints) {
        for (const k of keys) {
          for (const body of bodyVariants(k)) {
            const r = await postJSON(ep, body, 6500);
            last = { ep, body, ok: r.ok, status: r.status, data: r.data };

            const errCode = String(r.data?.error ?? r.data?.message ?? "").toUpperCase();
            if (errCode === "BUY_FAILED") continue; // пробуем другой ключ

            if (!r.ok) {
              const s = String(r.data?.error ?? r.data?.message ?? "").toLowerCase();
              const unknown =
                r.status === 404 || s.includes("unknown") || s.includes("not found") || s.includes("не найден");
              if (unknown) continue;
              break outer;
            }

            const extracted = extractView(r.data, def.positions);

            // ✅ УСПЕХ: есть cards
            if (Array.isArray(extracted.cards) && extracted.cards.length > 0) {
              setViews((m) => ({
                ...m,
                [def.id]: {
                  title: def.title,
                  cards: extracted.cards,
                  positions: extracted.positions ?? def.positions,
                  interpretation: extracted.interpretation ?? "",
                  resetToken: `${def.id}-${Date.now()}`,
                },
              }));

              // ✅ обновим баланс в шапке
              window.dispatchEvent(new Event("balance:refresh"));

              window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred?.("success");
              return; // 🔥 важно: не продолжаем и НЕ ставим ошибку
            }

            // ok, но без cards
            setErrs((m) => ({
              ...m,
              [def.id]: {
                text: "Сервер ответил, но не вернул карты/трактовку.",
                debug: JSON.stringify(last, null, 2),
              },
            }));
            return;
          }
        }
      }

      // если дошли сюда — успеха не было
      setErrs((m) => ({
        ...m,
        [def.id]: {
          text: String(last?.data?.error ?? last?.data?.message ?? "Не получилось"),
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
        {/* без “Все”, но по умолчанию показываем все */}
        <div className="segRow segRowEqual">
          <button className={`segBtn ${filter === "general" ? "segBtnActive" : ""}`} onClick={() => setFilter(filter === "general" ? "all" : "general")}>
            Ситуация
          </button>
          <button className={`segBtn ${filter === "love" ? "segBtnActive" : ""}`} onClick={() => setFilter(filter === "love" ? "all" : "love")}>
            Отношения
          </button>
          <button className={`segBtn ${filter === "money" ? "segBtnActive" : ""}`} onClick={() => setFilter(filter === "money" ? "all" : "money")}>
            Финансы
          </button>
          <button className={`segBtn ${filter === "health" ? "segBtnActive" : ""}`} onClick={() => setFilter(filter === "health" ? "all" : "health")}>
            Здоровье
          </button>
        </div>

        <div className="small" style={{ marginTop: 10 }}>
          Нажми категорию — отфильтруем. Нажми активную ещё раз — вернёшься ко всем.
        </div>
      </div>

      <div style={{ height: 12 }} />

      {/* расстояние между раскладами */}
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {list.map((s) => {
          const isBusy = busyId === s.id;
          const isActive = activeId === s.id;
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

              <button
                className={`btn ${isBusy ? "btnGhost" : "btnPrimary"}`}
                style={{ width: "100%" }}
                onClick={() => buy(s)}
                disabled={!!busyId}
              >
                {isBusy ? "Готовлю…" : "Сделать расклад"}
              </button>

              {/* ✅ сворачиваем, когда расклад уже показан */}
              {isActive && (v || err) ? (
                <div style={{ marginTop: 10 }}>
                  <button
                    type="button"
                    className="btn btnGhost"
                    style={{ width: "100%" }}
                    onClick={() => collapseIfActive(s.id)}
                  >
                    Свернуть
                  </button>
                </div>
              ) : null}

              {isActive && v ? (
                <div style={{ marginTop: 12, touchAction: "pan-y" }} onClick={(e) => e.stopPropagation()}>
                  <SpreadReveal
                    cards={v.cards}
                    positions={v.positions}
                    interpretation={v.interpretation}
                    resetToken={v.resetToken}
                  />
                </div>
              ) : null}

              {isActive && err ? (
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
