"use client";

import { useEffect, useMemo, useState } from "react";
import { Modal } from "@/components/Modal";
import { ruTitleFromSlug } from "@/lib/ruTitles";

type WheelCard = {
  slug?: string;
  titleRu?: string;
  meaningRu: string;
  adviceRu: string;
  image: string;
};

type WheelArchiveItem = { date: string; card: WheelCard };

const TZ = "Europe/Helsinki";

function dayKey(d: Date) {
  // "2025-12-13"
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

export function Wheel() {
  const [statusLoading, setStatusLoading] = useState(true);
  const [canSpin, setCanSpin] = useState(false);
  const [todayItem, setTodayItem] = useState<WheelArchiveItem | null>(null);

  const [spinning, setSpinning] = useState(false);
  const [rot, setRot] = useState(0);

  const [open, setOpen] = useState(false);
  const [card, setCard] = useState<WheelCard | null>(null);
  const [modalTitle, setModalTitle] = useState("Колесо фортуны");

  const [error, setError] = useState<string | null>(null);

  const todayKey = useMemo(() => dayKey(new Date()), []);

  useEffect(() => {
    // Проверяем: был ли уже спин сегодня (через /api/archive)
    async function loadStatus() {
      try {
        const r = await fetch("/api/archive", { cache: "no-store" });
        const d = await r.json();
        const wheel: WheelArchiveItem[] = d?.wheel ?? [];

        const t = wheel.find((it) => {
          const dk = dayKey(new Date(it.date));
          return dk === todayKey;
        });

        if (t) {
          setTodayItem(t);
          setCanSpin(false);
        } else {
          setCanSpin(true);
        }
      } catch (e) {
        // если что-то пошло не так — не ломаем UX, но разрешим попытку
        setCanSpin(true);
      } finally {
        setStatusLoading(false);
      }
    }

    loadStatus();
  }, [todayKey]);

  function titleFor(c: WheelCard | null) {
    if (!c) return "";
    if (c.slug) return ruTitleFromSlug(c.slug);
    return c.titleRu ?? "Карта";
  }

  async function spin() {
    if (!canSpin || spinning) return;

    setError(null);
    setSpinning(true);

    // 1) сначала просим сервер выдать карту и сохранить спин
    let picked: WheelCard | null = null;
    try {
      const r = await fetch("/api/wheel/spin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      const d = await r.json();

      if (!r.ok) {
        // если сервер сказал "уже крутил"
        const code = String(d?.error ?? "").toUpperCase();
        if (code.includes("ALREADY")) {
          // Подтягиваем сегодняшнюю карту из архива (если не было)
          if (!todayItem) {
            try {
              const ar = await fetch("/api/archive", { cache: "no-store" });
              const ad = await ar.json();
              const wheel: WheelArchiveItem[] = ad?.wheel ?? [];
              const t = wheel.find((it) => dayKey(new Date(it.date)) === todayKey) ?? null;
              setTodayItem(t);
            } catch {}
          }

          setCanSpin(false);
          setSpinning(false);
          setError("Сегодня ты уже крутил(а) колесо.");
          return;
        }

        setSpinning(false);
        setError(d?.message ?? "Не удалось прокрутить.");
        return;
      }

      picked = d?.card ?? null;
    } catch {
      setSpinning(false);
      setError("Сеть шалит. Попробуй ещё раз.");
      return;
    }

    if (!picked) {
      setSpinning(false);
      setError("Не удалось получить карту.");
      return;
    }

    // 2) анимация колеса
    const extraTurns = 360 * (5 + Math.floor(Math.random() * 2)); // 5–6 оборотов
    const offset = Math.floor(Math.random() * 360);
    const target = rot + extraTurns + offset;

    // haptics
    window.Telegram?.WebApp?.HapticFeedback?.impactOccurred?.("medium");

    setRot(target);

    // 3) после анимации показываем карту
    const durationMs = 3200;

    setTimeout(() => {
      const item: WheelArchiveItem = { date: new Date().toISOString(), card: picked! };
      setTodayItem(item);
      setCanSpin(false);

      setCard(picked);
      setModalTitle(`Колесо • ${titleFor(picked)}`);
      setOpen(true);

      setSpinning(false);
      window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred?.("success");
    }, durationMs);
  }

  function openToday() {
    if (!todayItem) return;
    setCard(todayItem.card);
    setModalTitle(`Колесо • ${titleFor(todayItem.card)}`);
    setOpen(true);
  }

  const btnText = statusLoading
    ? "Проверяю…"
    : spinning
    ? "Крутим…"
    : canSpin
    ? "Прокрутить колесо"
    : "Доступно завтра";

  return (
    <div className="card">
      <div className="title">Колесо фортуны</div>
      <div className="small" style={{ marginTop: 4 }}>
        Один раз в сутки — и только одна карта. Повторения возможны.
      </div>

      <div style={{ height: 10 }} />

      <div className="pointer" />
      <div className="wheelWrap">
        <div className="sparkStage">
          <div
            className="wheel"
            style={{
              transform: `rotate(${rot}deg)`,
              transition: spinning
                ? "transform 3.2s cubic-bezier(0.12, 0.72, 0.20, 1)"
                : "transform 0.2s ease",
              willChange: "transform",
            }}
          />
          {/* искры — только во время кручения */}
          {spinning ? (
            <div className="sparkLayer">
              {Array.from({ length: 10 }).map((_, i) => {
                const a = (i / 10) * Math.PI * 2;
                const r = 88 + (i % 3) * 10;
                const x = 110 + Math.cos(a) * r;
                const y = 110 + Math.sin(a) * r;
                return (
                  <div
                    key={i}
                    className="sparkDot"
                    style={{
                      left: x,
                      top: y,
                      opacity: 0.9,
                      animation: `spark ${700 + (i % 3) * 120}ms ease-in-out ${i * 40}ms infinite`,
                    }}
                  />
                );
              })}
            </div>
          ) : null}
        </div>
      </div>

      {error ? (
        <div className="small" style={{ marginTop: 8 }}>
          {error}
        </div>
      ) : null}

      {!statusLoading && !canSpin && todayItem ? (
        <div className="small" style={{ marginTop: 8 }}>
          Сегодня выпало: <b>{titleFor(todayItem.card)}</b>
        </div>
      ) : null}

      <div style={{ height: 12 }} />

      <button
        className={`btn ${canSpin ? "btnPrimary" : "btnGhost"}`}
        style={{ width: "100%" }}
        onClick={spin}
        disabled={statusLoading || spinning || !canSpin}
      >
        {btnText}
      </button>

      {!statusLoading && !canSpin && todayItem ? (
        <div style={{ marginTop: 10 }}>
          <button className="btn btnGhost" style={{ width: "100%" }} onClick={openToday}>
            Открыть сегодняшнюю карту
          </button>
        </div>
      ) : null}

      <Modal open={open} title={modalTitle} onClose={() => setOpen(false)}>
        {!card ? (
          <p className="text">…</p>
        ) : (
          <div className="row">
            <img className="img" src={card.image} alt={titleFor(card)} loading="lazy" decoding="async" />
            <div className="col">
              <div className="title" style={{ fontSize: 16 }}>{titleFor(card)}</div>
              <p className="text" style={{ marginTop: 6 }}>{card.meaningRu}</p>
              <div className="small" style={{ marginTop: 8 }}><b>Совет</b></div>
              <p className="text" style={{ marginTop: 6 }}>{card.adviceRu}</p>
            </div>
          </div>
        )}
      </Modal>

      {/* keyframes для искр */}
      <style>{`
        @keyframes spark {
          0% { transform: translate(-50%, -50%) scale(.7); opacity: .2; }
          40% { transform: translate(-50%, -50%) scale(1.15); opacity: .95; }
          100% { transform: translate(-50%, -50%) scale(.85); opacity: .35; }
        }
      `}</style>
    </div>
  );
}
