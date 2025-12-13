"use client";

import { useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Modal } from "@/components/Modal";
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
  cards: { slug: string; image: string }[];
  positions: string[];
  interpretation: string;
  resetToken: string;
};

const SPREADS: SpreadDef[] = [
  {
    id: "three",
    title: "Три карты",
    price: 125,
    cardsCount: 3,
    tag: "general",
    brief:
      "Прошлое • Настоящее • Будущее — быстрый расклад, чтобы понять, откуда всё началось, что происходит сейчас и к чему ведёт.",
    positions: ["Прошлое", "Настоящее", "Будущее"],
  },
  {
    id: "couple_future",
    title: "Будущее пары",
    price: 125,
    cardsCount: 3,
    tag: "love",
    brief:
      "Перспектива отношений: мысли партнёра, что между вами сейчас и его чувства. Удобно для новичков.",
    positions: [
      "Мысли партнёра об отношениях",
      "Что происходит между вами сейчас",
      "Чувства партнёра к тебе",
    ],
  },
  {
    id: "station_for_two",
    title: "Вокзал для двоих",
    price: 250,
    cardsCount: 2,
    tag: "love",
    brief:
      "Про отношения в паре: что у тебя в голове и что у партнёра. Помогает увидеть разницу взглядов без драм.",
    positions: ["Твои мысли", "Мысли партнёра / его взгляд на отношения"],
  },
  {
    id: "money_on_barrel",
    title: "Деньги на бочку",
    price: 350,
    cardsCount: 5,
    tag: "money",
    brief:
      "Отношение к деньгам: привычки трат, сценарии, установки и что поменять, чтобы стало спокойнее и стабильнее.",
    positions: [
      "Моё отношение к деньгам",
      "Как я расходую",
      "Что меня ограничивает",
      "Что мне поможет",
      "Итог / направление",
    ],
  },
  {
    id: "money_tree",
    title: "Денежное дерево",
    price: 450,
    cardsCount: 5,
    tag: "money",
    brief:
      "Финансы как система: корень (прошлое), ствол (настоящее), помощники, блоки и итог — где рост и где утечки.",
    positions: [
      "Корень — прошлое / причины",
      "Ствол — настоящее",
      "Ветвь плодородия — помощники",
      "Ветвь проблем — помехи / страхи",
      "Плоды — итог / ответ",
    ],
  },
  {
    id: "my_health",
    title: "Моё здоровье",
    price: 550,
    cardsCount: 7,
    tag: "health",
    brief:
      "Самодиагностика: реальное состояние, что может ухудшать, что помогает восстановлению и на что стоит обратить внимание.",
    positions: [
      "S — Сигнификатор (я сейчас)",
      "Физическое состояние",
      "Эмоциональный фон",
      "Что истощает",
      "Что поддержит",
      "Рекомендация",
      "Тенденция / итог",
    ],
  },
  {
    id: "aibolit",
    title: "Доктор Айболит",
    price: 800,
    cardsCount: 9,
    tag: "health",
    brief:
      "Комплексный взгляд на здоровье: что важно прямо сейчас, что влияет, где слабое место и как мягко поддержать организм.",
    positions: [
      "1 — Состояние сейчас",
      "2 — Скрытый фактор",
      "3 — Поддержка (верх 1)",
      "4 — Поддержка (верх 2)",
      "5 — Поддержка (верх 3)",
      "6 — Поддержка (верх 4)",
      "7 — Уязвимость (низ 1)",
      "8 — Уязвимость (низ 2)",
      "9 — Уязвимость (низ 3)",
    ],
  },
  {
    id: "celtic_cross",
    title: "Кельтский крест",
    price: 1500,
    cardsCount: 10,
    tag: "general",
    brief:
      "Глубокий универсальный расклад на ситуацию: причины, скрытые влияния, развитие и вероятный исход. Подходит, когда хочется ясности.",
    positions: [
      "1 — Суть ситуации",
      "2 — Препятствие / вызов",
      "3 — Основание / причина",
      "4 — Прошлое (что привело)",
      "5 — Возможный рост / потенциал",
      "6 — Ближайшее будущее",
      "7 — Ты в ситуации",
      "8 — Окружение / влияние извне",
      "9 — Надежды и страхи",
      "10 — Итог / вероятный исход",
    ],
  },
];

function tagLabel(tag: SpreadDef["tag"]) {
  if (tag === "love") return "Отношения";
  if (tag === "money") return "Финансы";
  if (tag === "health") return "Здоровье";
  return "Ситуация";
}

function tagGlyph(tag: SpreadDef["tag"]) {
  if (tag === "love") return "♡";
  if (tag === "money") return "✦";
  if (tag === "health") return "☤";
  return "✶";
}

async function postTry(url: string, body: any) {
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  const data = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, data };
}

function humanizeError(e: any) {
  const raw = String(e?.message ?? e?.error ?? e ?? "");
  const code = raw.trim().toUpperCase();

  if (code === "BUY_FAILED") return "Покупка не прошла. Обычно это временно или из-за формата запроса. Попробуй ещё раз.";
  if (code.includes("INSUFFICIENT") || raw.toLowerCase().includes("недостат"))
    return "Недостаточно валюты для этого расклада.";
  if (code.includes("ALREADY")) return "Этот расклад уже есть в архиве.";
  return raw || "Не удалось выполнить действие.";
}

export default function SpreadsPage() {
  const [open, setOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState("Расклад");
  const [view, setView] = useState<View | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [shopOpen, setShopOpen] = useState(false);

  // красивое окно ошибок вместо alert()
  const [errOpen, setErrOpen] = useState(false);
  const [errText, setErrText] = useState("");

  const [filter, setFilter] = useState<"all" | "general" | "love" | "money" | "health">("all");

  const list = useMemo(() => {
    if (filter === "all") return SPREADS;
    return SPREADS.filter((s) => s.tag === filter);
  }, [filter]);

  async function buy(def: SpreadDef) {
    if (busyId) return;
    setBusyId(def.id);

    try {
      // ✅ ключевой момент: сервер может ожидать РАЗНЫЙ body.
      // Пробуем несколько вариантов от самого "узкого" к более подробному.
      const bodies = [
        { spreadId: def.id },
        { id: def.id },
        { spreadId: def.id, spreadTitle: def.title },
        { spreadId: def.id, title: def.title },
        // если сервер ожидает цену/позиции — это последний (самый широкий) вариант
        { spreadId: def.id, spreadTitle: def.title, paidAmount: def.price, cardsCount: def.cardsCount, positions: def.positions },
      ];

      const endpoints = ["/api/spreads/buy", "/api/spreads/purchase"];

      let res: { ok: boolean; status: number; data: any } | null = null;

      for (const ep of endpoints) {
        for (const b of bodies) {
          const r = await postTry(ep, b);
          // если эндпоинта нет — пробуем следующий
          if (r.status === 404) continue;
          // если успех — выходим
          if (r.ok) { res = r; break; }
          // если это валидация/формат — пробуем следующий body
          res = r;
        }
        if (res?.ok) break;
      }

      if (!res || !res.ok) {
        const msg = humanizeError(res?.data ?? "BUY_FAILED");
        setErrText(msg);
        setErrOpen(true);

        // если похоже на недостаток — откроем магазин
        if (msg.toLowerCase().includes("недостат")) setShopOpen(true);
        return;
      }

      // сервер может вернуть по-разному — нормализуем
      const cards = (res.data?.cards ?? res.data?.result?.cards ?? []) as { slug: string; image: string }[];
      const interpretation = String(res.data?.interpretation ?? res.data?.result?.interpretation ?? "");
      const positions = (res.data?.positions ?? res.data?.result?.positions ?? def.positions) as string[];

      setView({
        cards,
        positions,
        interpretation,
        resetToken: `${def.id}-${Date.now()}`,
      });

      setModalTitle(def.title);
      setOpen(true);
      window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred?.("success");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <AppShell title="Расклады">
      <h1 className="h1">Расклады</h1>
      <RitualHeader label="Выбери формат" />

      <div className="card">
        <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div className="title">Категории</div>
            <div className="small">Короткое объяснение каждого расклада</div>
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
            <div className="row" style={{ alignItems: "center" }}>
              <div className="spreadGlyph">{tagGlyph(s.tag)}</div>

              <div className="col" style={{ gap: 6 }}>
                <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline" }}>
                  <div className="title">{s.title}</div>
                  <div className="spreadPrice">{s.price}</div>
                </div>

                <div className="small">
                  <span className="spreadTag">{tagLabel(s.tag)}</span>
                  <span style={{ marginLeft: 8 }}>{s.cardsCount} карт</span>
                </div>

                <div className="small" style={{ marginTop: 2 }}>{s.brief}</div>

                <div style={{ height: 8 }} />

                <button
                  className={`btn ${busyId === s.id ? "btnGhost" : "btnPrimary"}`}
                  style={{ width: "100%" }}
                  onClick={() => buy(s)}
                  disabled={!!busyId}
                >
                  {busyId === s.id ? "Готовлю расклад…" : "Сделать расклад"}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Просмотр расклада */}
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

      {/* Красивое окно ошибки вместо alert */}
      <Modal open={errOpen} title="Не получилось" onClose={() => setErrOpen(false)}>
        <p className="text" style={{ whiteSpace: "pre-wrap" }}>{errText}</p>
        <div style={{ height: 12 }} />
        <button className="btn btnGhost" style={{ width: "100%" }} onClick={() => setErrOpen(false)}>
          Ок
        </button>
      </Modal>

      {/* Магазин-заглушка */}
      <Modal open={shopOpen} title="Магазин" onClose={() => setShopOpen(false)}>
        <div className="small">Telegram Stars подключим позже — сейчас это заглушка.</div>
        <div style={{ height: 10 }} />
        <div className="card" style={{ padding: 12 }}>
          <div className="title">Паки валюты</div>
          <div className="small" style={{ marginTop: 6 }}>
            99 ⭐ → 150 • 199 ⭐ → 350 • 399 ⭐ → 800 • 799 ⭐ → 1800
          </div>
        </div>
      </Modal>
    </AppShell>
  );
}
