"use client";

import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { RitualHeader } from "@/components/RitualHeader";
import { Modal } from "@/components/Modal";
import { Wheel } from "@/components/Wheel";
import { ruTitleFromSlug } from "@/lib/ruTitles";

type DailyCard = {
  slug?: string;
  titleRu?: string;
  meaningRu: string;
  adviceRu: string;
  image: string;
};

function titleFor(c: DailyCard | null) {
  if (!c) return "";
  if (c.slug) return ruTitleFromSlug(c.slug);
  return c.titleRu ?? "Карта дня";
}

export default function HomePage() {
  const [daily, setDaily] = useState<DailyCard | null>(null);
  const [dailyLoading, setDailyLoading] = useState(true);
  const [flipped, setFlipped] = useState(false);

  const [balance, setBalance] = useState<number | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(true);
  const [shopOpen, setShopOpen] = useState(false);

  const [errOpen, setErrOpen] = useState(false);
  const [errText, setErrText] = useState("");

  const todayRu = useMemo(() => {
    return new Date().toLocaleDateString("ru-RU", { day: "2-digit", month: "long" });
  }, []);

  useEffect(() => {
    async function loadDaily() {
      setDailyLoading(true);
      try {
        const r = await fetch("/api/daily", { cache: "no-store" });
        const d = await r.json().catch(() => ({}));
        if (!r.ok) {
          setErrText(String(d?.message ?? d?.error ?? "Не удалось получить карту дня."));
          setErrOpen(true);
          return;
        }
        setDaily(d?.card ?? d);
      } catch {
        setErrText("Сеть шалит. Не удалось загрузить карту дня.");
        setErrOpen(true);
      } finally {
        setDailyLoading(false);
      }
    }
    loadDaily();
  }, []);

  useEffect(() => {
    async function loadBalance() {
      setBalanceLoading(true);
      try {
        const r = await fetch("/api/me", { cache: "no-store" });
        const d = await r.json().catch(() => ({}));

        // если /api/me отсутствует — просто не ломаем UI
        if (r.status === 404) {
          setBalance(null);
          return;
        }
        if (!r.ok) {
          setBalance(null);
          return;
        }

        // поддержим разные форматы ответа
        const b =
          typeof d?.balance === "number"
            ? d.balance
            : typeof d?.user?.balance === "number"
            ? d.user.balance
            : null;

        setBalance(b);
      } catch {
        setBalance(null);
      } finally {
        setBalanceLoading(false);
      }
    }
    loadBalance();
  }, []);

  function onFlip() {
    setFlipped(true);
    window.Telegram?.WebApp?.HapticFeedback?.impactOccurred?.("light");
  }

  return (
    <AppShell title="Карта дня">
      {/* Баланс + магазин */}
      <div className="card" style={{ padding: 12 }}>
        <div className="row" style={{ alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div className="title">Карта Дня</div>
            <div className="small">Сегодня: {todayRu} • карта общая для всех</div>
          </div>

          <div className="row" style={{ gap: 8, alignItems: "center" }}>
            <div className="badge" style={{ padding: "8px 10px" }}>
              {balanceLoading ? "…" : balance === null ? "—" : balance}
            </div>

            <button
              className="btn btnPrimary"
              style={{ padding: "10px 12px", borderRadius: 14, width: 42 }}
              onClick={() => setShopOpen(true)}
              aria-label="Магазин"
            >
              +
            </button>
          </div>
        </div>
      </div>

      <div style={{ height: 12 }} />

      <h1 className="h1">Главная</h1>
      <RitualHeader label="Твой знак на сегодня" />

      {/* Карта дня */}
      <div className="card">
        <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline" }}>
          <div className="title">Карта дня</div>
          <div className="small">{flipped ? "Открыто" : "Нажми на карту"}</div>
        </div>

        <div style={{ height: 12 }} />

        {dailyLoading ? (
          <div className="row">
            <div className="shimmer" style={{ width: 96, height: 156, borderRadius: 14 }} />
            <div className="col">
              <div className="shimmer" style={{ height: 14, width: "70%" }} />
              <div className="shimmer" style={{ height: 12, width: "92%" }} />
              <div className="shimmer" style={{ height: 12, width: "86%" }} />
              <div style={{ height: 10 }} />
              <div className="shimmer" style={{ height: 14, width: "60%" }} />
              <div className="shimmer" style={{ height: 12, width: "90%" }} />
            </div>
          </div>
        ) : !daily ? (
          <div className="small">Не удалось загрузить карту дня.</div>
        ) : (
          <div className="row">
            {/* Flip */}
            <button
              className="pressable"
              onClick={onFlip}
              style={{
                border: "none",
                background: "transparent",
                padding: 0,
                cursor: "pointer",
              }}
              aria-label="Открыть карту дня"
            >
              <div className="flipWrap">
                <div
                  className="flipInner"
                  style={{
                    transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
                    transition: "transform 700ms cubic-bezier(.2,.7,.2,1)",
                  }}
                >
                  {/* FRONT (рубашка) */}
                  <div className="flipFace">
                    <img
                      src="/cards/card-back.jpg"
                      alt="Рубашка карты"
                      loading="lazy"
                      decoding="async"
                    />
                    <div className="flipShine" />
                  </div>

                  {/* BACK (лицо карты) */}
                  <div className="flipFace flipBack">
                    <img src={daily.image} alt={titleFor(daily)} loading="lazy" decoding="async" />
                  </div>
                </div>
              </div>
              <div className="flipHint">{flipped ? "Твоя карта" : "Нажми, чтобы открыть"}</div>
            </button>

            {/* Text */}
            <div className="col">
              <div className="title" style={{ fontSize: 16 }}>
                {flipped ? titleFor(daily) : "…"}
              </div>

              <div className="small" style={{ marginTop: 2 }}>
                {flipped ? "Что означает" : "Открой карту — и увидишь смысл"}
              </div>

              {flipped ? (
                <>
                  <p className="text" style={{ marginTop: 6 }}>
                    {daily.meaningRu}
                  </p>

                  {/* ✅ Выделенный совет */}
                  <div className="adviceBox" style={{ marginTop: 12 }}>
                    <div className="adviceTitle">Совет</div>
                    <div className="adviceText">{daily.adviceRu}</div>
                  </div>
                </>
              ) : null}
            </div>
          </div>
        )}
      </div>

      <div style={{ height: 12 }} />

      {/* Колесо фортуны */}
      <Wheel />

      {/* Магазин */}
      <Modal open={shopOpen} title="Магазин" onClose={() => setShopOpen(false)}>
        <div className="small">
          Telegram Stars подключим позже — сейчас это заглушка.
        </div>

        <div style={{ height: 10 }} />

        <div className="card" style={{ padding: 12 }}>
          <div className="title">Паки валюты</div>
          <div className="small" style={{ marginTop: 6 }}>
            99 ⭐ → 150 • 199 ⭐ → 350 • 399 ⭐ → 800 • 799 ⭐ → 1800
          </div>
        </div>
      </Modal>

      {/* Ошибка (красиво, без alert) */}
      <Modal open={errOpen} title="Не получилось" onClose={() => setErrOpen(false)}>
        <p className="text" style={{ whiteSpace: "pre-wrap" }}>
          {errText}
        </p>
        <div style={{ height: 12 }} />
        <button className="btn btnGhost" style={{ width: "100%" }} onClick={() => setErrOpen(false)}>
          Ок
        </button>
      </Modal>
    </AppShell>
  );
}
