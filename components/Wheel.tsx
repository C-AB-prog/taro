"use client";

import { useEffect, useMemo, useState } from "react";
import { ruTitleFromSlug } from "@/lib/ruTitles";

type WheelCard = {
  slug?: string;
  titleRu?: string;
  meaningRu: string;
  adviceRu: string;
  image: string;
};

type WheelArchiveItem = any;

function dayKeyLocal(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function minutesToNextLocalDay() {
  const now = new Date();
  const next = new Date(now);
  next.setHours(24, 0, 0, 0);
  const ms = Math.max(0, next.getTime() - Date.now());
  return Math.ceil(ms / 60000);
}

function pickTs(x: any) {
  return String(x?.createdAt ?? x?.date ?? x?.ts ?? "");
}

function toWheelCard(w: any): WheelCard | null {
  const c = w?.card ?? w;
  const image = c?.image ?? w?.image;
  const meaningRu = c?.meaningRu ?? w?.meaningRu;
  const adviceRu = c?.adviceRu ?? w?.adviceRu;
  const slug = c?.slug ?? w?.slug;
  const titleRu = c?.titleRu ?? w?.titleRu;
  if (!image || !meaningRu || !adviceRu) return null;
  return { image: String(image), meaningRu: String(meaningRu), adviceRu: String(adviceRu), slug, titleRu };
}

function titleFor(c: WheelCard | null) {
  if (!c) return "Карта";
  if (c.slug) return ruTitleFromSlug(c.slug);
  return c.titleRu ?? "Карта";
}

export function Wheel() {
  const [loading, setLoading] = useState(true);
  const [canSpin, setCanSpin] = useState(false);
  const [hint, setHint] = useState<string | null>(null);

  const [todayItem, setTodayItem] = useState<WheelArchiveItem | null>(null);

  const [rot, setRot] = useState(0);
  const [spinning, setSpinning] = useState(false);

  const [openToday, setOpenToday] = useState(false);
  const [todayCard, setTodayCard] = useState<WheelCard | null>(null);

  const todayKey = useMemo(() => dayKeyLocal(new Date()), []);

  async function loadStatus() {
    setLoading(true);
    try {
      const r = await fetch("/api/archive", { cache: "no-store" });
      const d = await r.json().catch(() => ({}));
      const wheel: WheelArchiveItem[] = d?.wheel ?? d?.wheelSpins ?? d?.wheelItems ?? [];

      const found = (wheel || []).find((it) => {
        const ts = pickTs(it);
        const dt = ts ? new Date(ts) : null;
        if (!dt || Number.isNaN(dt.getTime())) return false;
        return dayKeyLocal(dt) === todayKey;
      });

      setTodayItem(found ?? null);

      const c = found ? toWheelCard(found) : null;
      setTodayCard(c);

      if (found) {
        setCanSpin(false);
        setHint(`Ты уже крутил(а) сегодня. Вернись через ~${minutesToNextLocalDay()} мин.`);
      } else {
        setCanSpin(true);
        setHint(null);
      }
    } catch {
      setCanSpin(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadStatus();
    const t = setInterval(() => {
      if (!canSpin) setHint(`Ты уже крутил(а) сегодня. Вернись через ~${minutesToNextLocalDay()} мин.`);
    }, 30000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todayKey]);

  async function spin() {
    if (loading || spinning) return;

    if (!canSpin) {
      setHint(`Ты уже крутил(а) сегодня. Вернись через ~${minutesToNextLocalDay()} мин.`);
      window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred?.("warning");
      return;
    }

    setSpinning(true);
    setHint(null);

    try {
      const r = await fetch("/api/wheel/spin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        setHint(String(d?.message ?? d?.error ?? "Не удалось прокрутить."));
        setSpinning(false);
        return;
      }

      const picked: WheelCard | null = d?.card ?? null;
      if (!picked) {
        setHint("Не удалось получить карту.");
        setSpinning(false);
        return;
      }

      const extraTurns = 360 * (5 + Math.floor(Math.random() * 2));
      const offset = Math.floor(Math.random() * 360);
      setRot((v) => v + extraTurns + offset);

      setTimeout(async () => {
        setTodayCard(picked);
        setOpenToday(true);
        setSpinning(false);
        // перезагрузим статус, чтобы появилась “какая карта”
        await loadStatus();
        window.Telegram?.WebApp?.HapticFeedback?.notificationOccurred?.("success");
      }, 2600);
    } catch {
      setHint("Сеть шалит. Попробуй ещё раз.");
      setSpinning(false);
    }
  }

  async function openTodayCard() {
    // если почему-то потеряли todayCard — обновим статус
    if (!todayCard) await loadStatus();
    setOpenToday(true);
  }

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
          <button className="btn btnGhost" style={{ width: "100%" }} onClick={openTodayCard}>
            Какая карта сегодня выпала
          </button>
        </div>
      ) : null}

      {/* “модалка как в раскладах” — внутри блока, не ломает скролл */}
      {openToday && todayCard ? (
        <div style={{ marginTop: 12 }}>
          <div className="card" style={{ padding: 12 }}>
            <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline" }}>
              <div className="title" style={{ fontSize: 14 }}>{titleFor(todayCard)}</div>
              <button className="btn btnGhost" style={{ padding: "8px 10px" }} onClick={() => setOpenToday(false)}>
                Закрыть
              </button>
            </div>

            <div style={{ height: 10 }} />

            <div className="row">
              <img className="img" src={todayCard.image} alt={titleFor(todayCard)} loading="lazy" decoding="async" />
              <div className="col">
                <p className="text">{todayCard.meaningRu}</p>
                <div className="adviceBox" style={{ marginTop: 12 }}>
                  <div className="adviceTitle">Совет</div>
                  <div className="adviceText">{todayCard.adviceRu}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
