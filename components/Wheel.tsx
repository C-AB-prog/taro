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

type WheelArchiveItem = {
  date?: string;
  createdAt?: string;
  card?: WheelCard;
  // fallback
  slug?: string;
  titleRu?: string;
  meaningRu?: string;
  adviceRu?: string;
  image?: string;
};

function startOfNextLocalDayMs() {
  const now = new Date();
  const next = new Date(now);
  next.setHours(24, 0, 0, 0);
  return next.getTime();
}

function minutesToNextLocalDay() {
  const ms = Math.max(0, startOfNextLocalDayMs() - Date.now());
  return Math.ceil(ms / 60000);
}

function cardFromAny(w: WheelArchiveItem | null): WheelCard | null {
  if (!w) return null;
  if ((w as any).card?.image) return (w as any).card as WheelCard;
  if ((w as any).image && (w as any).meaningRu && (w as any).adviceRu) {
    return {
      slug: (w as any).slug,
      titleRu: (w as any).titleRu,
      meaningRu: String((w as any).meaningRu),
      adviceRu: String((w as any).adviceRu),
      image: String((w as any).image),
    };
  }
  return null;
}

function titleFor(c: WheelCard | null) {
  if (!c) return "Карта";
  if (c.slug) return ruTitleFromSlug(c.slug);
  return c.titleRu ?? "Карта";
}

function dayKeyLocal(d: Date) {
  // сравнение “сегодня” по локальному календарному дню
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

export function Wheel() {
  const [loading, setLoading] = useState(true);

  const [todayItem, setTodayItem] = useState<WheelArchiveItem | null>(null);
  const [canSpin, setCanSpin] = useState(false);

  const [rot, setRot] = useState(0);
  const [spinning, setSpinning] = useState(false);

  const [hint, setHint] = useState<string | null>(null);

  const [open, setOpen] = useState(false);
  const [card, setCard] = useState<WheelCard | null>(null);
  const [modalTitle, setModalTitle] = useState("Колесо фортуны");

  const todayKey = useMemo(() => dayKeyLocal(new Date()), []);

  useEffect(() => {
    let timer: any;

    async function load() {
      setLoading(true);
      try {
        const r = await fetch("/api/archive", { cache: "no-store" });
        const d = await r.json().catch(() => ({}));
        const wheel: WheelArchiveItem[] = d?.wheel ?? d?.wheelSpins ?? d?.wheelItems ?? [];

        const found = (wheel || []).find((it) => {
          const ts = String(it.date ?? it.createdAt ?? "");
          const dt = ts ? new Date(ts) : null;
          if (!dt || Number.isNaN(dt.getTime())) return false;
          return dayKeyLocal(dt) === todayKey;
        });

        if (found) {
          setTodayItem(found);
          setCanSpin(false);
          setHint(`Ты уже крутил(а) сегодня. Вернись через ~${minutesToNextLocalDay()} мин.`);
          timer = setInterval(() => {
            setHint(`Ты уже крутил(а) сегодня. Вернись через ~${minutesToNextLocalDay()} мин.`);
          }, 30000);
        } else {
          setTodayItem(null);
          setCanSpin(true);
          setHint(null);
        }
      } catch {
        setCanSpin(true);
      } finally {
        setLoading(false);
      }
    }

    load();
    return () => timer && clearInterval(timer);
  }, [todayKey]);

  async function spin() {
    // ✅ можно нажимать даже если уже крутили — покажем подсказку с минутами
    if (!canSpin) {
      setHint(`Ты уже крутил(а) сегодня. Вернись через ~${minutesToNextLocalDay()} мин.`);
      window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred?.("warning");
      // лёгкий “пинок” анимации без прокрутки
      setRot((v) => v + 10);
      setTimeout(() => setRot((v) => v - 10), 120);
      return;
    }

    if (spinning || loading) return;

    setHint(null);
    setSpinning(true);

    try {
      const r = await fetch("/api/wheel/spin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      const d = await r.json().catch(() => ({}));

      if (!r.ok) {
        setSpinning(false);
        setHint(String(d?.message ?? d?.error ?? "Не удалось прокрутить."));
        return;
      }

      const picked: WheelCard | null = d?.card ?? null;
      if (!picked) {
        setSpinning(false);
        setHint("Не удалось получить карту.");
        return;
      }

      window.Telegram?.WebApp?.HapticFeedback?.impactOccurred?.("medium");

      const extraTurns = 360 * (5 + Math.floor(Math.random() * 2));
      const offset = Math.floor(Math.random() * 360);
      const target = rot + extraTurns + offset;

      setRot(target);

      setTimeout(() => {
        // фиксируем “сегодняшнее”
        const it: WheelArchiveItem = { date: new Date().toISOString(), card: picked };
        setTodayItem(it);
        setCanSpin(false);

        setCard(picked);
        setModalTitle(`Колесо • ${titleFor(picked)}`);
        setOpen(true);

        setHint(`Ты уже крутил(а) сегодня. Вернись через ~${minutesToNextLocalDay()} мин.`);
        setSpinning(false);

        window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred?.("success");
      }, 2600);
    } catch {
      setSpinning(false);
      setHint("Сеть шалит. Попробуй ещё раз.");
    }
  }

  function openToday() {
    const c = cardFromAny(todayItem);
    if (!c) return;
    setCard(c);
    setModalTitle(`Колесо • ${titleFor(c)}`);
    setOpen(true);
  }

  const todayCard = cardFromAny(todayItem);

  return (
    <div className="card">
      <div className="title">Колесо фортуны</div>
      <div className="small" style={{ marginTop: 4 }}>
        Один раз в день. Если уже крутили — покажу, через сколько минут можно снова.
      </div>

      <div style={{ height: 12 }} />

      <div className="wheelMinimal">
        <div className="wheelPointerDown" aria-hidden="true" />
        <div className="wheelRing">
          <div
            className="wheelSpin"
            style={{
              transform: `rotate(${rot}deg)`,
              transition: spinning ? "transform 2.6s cubic-bezier(.14,.76,.18,1)" : "transform .18s ease",
              willChange: "transform",
            }}
          >
            <div className="wheelFace" />
          </div>

          <div className="wheelCenter">
            <div className="wheelDot" />
          </div>
        </div>
      </div>

      {todayCard ? (
        <div className="small" style={{ marginTop: 10 }}>
          Сегодня выпало: <b>{titleFor(todayCard)}</b>
        </div>
      ) : null}

      {hint ? <div className="small" style={{ marginTop: 8 }}>{hint}</div> : null}

      <div style={{ height: 12 }} />

      <button
        className={`btn ${canSpin ? "btnPrimary" : "btnGhost"}`}
        style={{ width: "100%" }}
        onClick={spin}
        disabled={loading || spinning}
      >
        {loading ? "Проверяю…" : spinning ? "Крутим…" : "Прокрутить колесо"}
      </button>

      {todayCard ? (
        <div style={{ marginTop: 10 }}>
          <button className="btn btnGhost" style={{ width: "100%" }} onClick={openToday}>
            Какая карта сегодня выпала
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
