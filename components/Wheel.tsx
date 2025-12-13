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

const TZ = "Europe/Moscow";

function dayKey(d: Date) {
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
    async function loadStatus() {
      try {
        const r = await fetch("/api/archive", { cache: "no-store" });
        const d = await r.json();
        const wheel: WheelArchiveItem[] = d?.wheel ?? [];

        const t = wheel.find((it) => dayKey(new Date(it.date)) === todayKey);
        if (t) {
          setTodayItem(t);
          setCanSpin(false);
        } else {
          setCanSpin(true);
        }
      } catch {
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

    let picked: WheelCard | null = null;

    try {
      const r = await fetch("/api/wheel/spin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const d = await r.json().catch(() => ({}));

      if (!r.ok) {
        const code = String(d?.error ?? d?.message ?? "").toUpperCase();
        if (code.includes("ALREADY")) {
          setCanSpin(false);
          setSpinning(false);
          setError("Сегодня ты уже крутил(а) колесо.");
          return;
        }
        setSpinning(false);
        setError(String(d?.message ?? d?.error ?? "Не удалось прокрутить."));
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

    const extraTurns = 360 * (5 + Math.floor(Math.random() * 2));
    const offset = Math.floor(Math.random() * 360);
    const target = rot + extraTurns + offset;

    window.Telegram?.WebApp?.HapticFeedback?.impactOccurred?.("medium");

    setRot(target);

    setTimeout(() => {
      const item: WheelArchiveItem = { date: new Date().toISOString(), card: picked! };
      setTodayItem(item);
      setCanSpin(false);

      setCard(picked);
      setModalTitle(`Колесо • ${titleFor(picked)}`);
      setOpen(true);

      setSpinning(false);
      window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred?.("success");
    }, 3200);
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
        </div>
      </div>

      {error ? <div className="small" style={{ marginTop: 8 }}>{error}</div> : null}

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

              {/* ✅ выделенный совет */}
              <div className="adviceBox" style={{ marginTop: 12 }}>
                <div className="adviceTitle">Совет</div>
                <div className="adviceText">{card.adviceRu}</div>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
