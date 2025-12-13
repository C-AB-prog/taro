"use client";

import { useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { Modal } from "@/components/Modal";
import { RitualHeader } from "@/components/RitualHeader";
import { SpreadReveal } from "@/components/SpreadReveal";
import { apiPostTryBodies, apiJson } from "@/lib/api";

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
    brief: "Отношения с деньгами: траты, установки, что поможет.",
    positions: ["Отношение", "Как трачу", "Что ограничивает", "Что поможет", "Итог"],
  },
  {
    id: "money_tree",
    title: "Денежное дерево",
    price: 450,
    cardsCount: 5,
    tag: "money",
    brief: "Про деньги системно: корень, ствол, помощники, блоки, итог.",
    positions: ["Корень", "Ствол", "Помощники", "Блоки", "Плоды/итог"],
  },
  {
    id: "my_health",
    title: "Моё здоровье",
    price: 550,
    cardsCount: 7,
    tag: "health",
    brief: "Мягкая самодиагностика: что влияет, что поддержит, тенденция.",
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
    brief: "Глубоко и подробно: причины, скрытые влияния, развитие, исход.",
    positions: ["1","2","3","4","5","6","7","8","9","10"],
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

function humanizeError(d: any) {
  const raw = String(d?.message ?? d?.error ?? d ?? "");
  const code = raw.trim().toUpperCase();
  if (code === "BUY_FAILED") return "Покупка не прошла. Попробуй ещё раз — иногда это временно.";
  if (code.includes("INSUFFICIENT") || raw.toLowerCase().includes("недостат"))
    return "Недостаточно валюты для этого расклада.";
  return raw || "Не удалось выполнить действие.";
}

export default function SpreadsPage() {
  const [open, setOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState("Расклад");
  const [view, setView] = useState<View | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [shopOpen, setShopOpen] = useState(false);
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
      const bodies = [
        { spreadId: def.id },
        { id: def.id },
        { spreadId: def.id, title: def.title },
        { spreadId: def.id, spreadTitle: def.title },
        { spreadId: def.id, spreadTitle: def.title, paidAmount: def.price, cardsCount: def.cardsCount, positions: def.positions },
      ];

      // пробуем buy -> purchase
      let res = await apiPostTryBodies("/api/spreads/buy", bodies);
      if (res.status === 404) res = await apiPostTryBodies("/api/spreads/purchase", bodies);

      if (!res.ok) {
        const msg = humanizeError(res.data);
        setErrText(msg);
        setErrOpen(true);
        if (msg.toLowerCase().includes("недостат")) setShopOpen(true);
        return;
      }

      const cards = (res.data?.cards ?? res.data?.result?.cards ?? []) as { slug: string; image: string }[];
      const interpretation = String(res.data?.interpretation ?? res.data?.result?.interpretation ?? "");
      const positions = (res.data?.positions ?? res.data?.result?.positions ?? def.positions) as string[];

      setView({ cards, positions, interpretation, resetToken: `${def.id}-${Date.now()}` });
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
            <div className="small">Короткое описание + мистическая трактовка</div>
          </div>
          <div className="badge" style={{ padding: "8px 12px" }}>{list.length}</div>
        </div>

        <div style={{ height: 10 }} />

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
        <div style={{ height: 12 }} />
        <button className="btn btnGhost" style={{ width: "100%" }} onClick={() => setErrOpen(false)}>
          Ок
        </button>
      </Modal>

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
