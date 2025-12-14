"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Modal } from "@/components/Modal";

type Card = {
  slug: string;
  titleRu: string;
  meaningRu: string;
  adviceRu: string;
  image: string;
};

function pad2(n: number) {
  return String(Math.max(0, n)).padStart(2, "0");
}
function fmtHMS(totalSeconds: number) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  return `${pad2(h)}:${pad2(m)}:${pad2(ss)}`;
}

export function Wheel() {
  const [loading, setLoading] = useState(true);
  const [already, setAlready] = useState(false);
  const [card, setCard] = useState<Card | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const [open, setOpen] = useState(false);

  const [spinning, setSpinning] = useState(false);
  const [deg, setDeg] = useState(0);

  const [leftSec, setLeftSec] = useState(0);
  const leftSecRef = useRef(0);

  const canSpin = !loading && !spinning && !already;

  const countdown = useMemo(() => fmtHMS(leftSec), [leftSec]);

  async function loadStatus() {
    setErr(null);
    setLoading(true);

    // 2 попытки (иногда сессия ставится чуть позже)
    for (let attempt = 0; attempt < 2; attempt++) {
      const r = await fetch("/api/wheel/status", { cache: "no-store", credentials: "include" }).catch(() => null);
      if (!r) {
        await new Promise((x) => setTimeout(x, 250));
        continue;
      }

      if (r.status === 401) {
        await new Promise((x) => setTimeout(x, 250));
        continue;
      }

      const d = await r.json().catch(() => ({}));
      if (d?.ok) {
        setAlready(!!d.already);
        setCard(d.card ?? null);
        const sec = Number(d.nextInSeconds || 0);
        setLeftSec(sec);
        leftSecRef.current = sec;
        setLoading(false);
        return;
      }

      await new Promise((x) => setTimeout(x, 250));
    }

    setLoading(false);
    setErr("Не удалось загрузить колесо. Открой мини-приложение через Telegram и попробуй снова.");
  }

  useEffect(() => {
    loadStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!already) return;
    const t = setInterval(() => {
      leftSecRef.current = Math.max(0, leftSecRef.current - 1);
      setLeftSec(leftSecRef.current);
    }, 1000);
    return () => clearInterval(t);
  }, [already]);

  async function spin() {
    if (!canSpin) return;

    setErr(null);
    setSpinning(true);

    const extra = 6 * 360 + Math.floor(Math.random() * 360);
    setDeg((prev) => prev + extra);

    try {
      const r = await fetch("/api/wheel/spin", {
        method: "POST",
        credentials: "include",
        cache: "no-store",
      });

      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        setErr("Не удалось прокрутить. Попробуй ещё раз.");
        setSpinning(false);
        return;
      }

      // дожидаемся завершения анимации, потом показываем
      setTimeout(() => {
        setAlready(true);
        // если backend не шлёт seconds — берём minutes
        const sec =
          typeof d?.nextInSeconds === "number"
            ? d.nextInSeconds
            : typeof d?.nextInMinutes === "number"
            ? Math.max(0, Math.ceil(d.nextInMinutes * 60))
            : leftSecRef.current;

        setLeftSec(sec);
        leftSecRef.current = sec;

        setCard(d.card ?? null);
        setOpen(true);
        setSpinning(false);

        // обновим архив/баланс где нужно
        window.dispatchEvent(new Event("balance:refresh"));
      }, 1150);
    } catch {
      setErr("Ошибка сети. Попробуй ещё раз.");
      setSpinning(false);
    }
  }

  return (
    <div className="card">
      <div className="title">Колесо фортуны</div>
      <div className="small" style={{ marginTop: 4 }}>
        Можно крутить 1 раз в сутки.
      </div>

      <div style={{ height: 10 }} />

      <div className="wheelMinimal">
        <div className="wheelPointerDown" />
        <div className="wheelRing" aria-hidden="true">
          <div
            className="wheelSpin"
            style={{
              transform: `rotate(${deg}deg)`,
              transition: spinning ? "transform 1150ms cubic-bezier(.2,.8,.2,1)" : "transform 0ms",
            }}
          >
            <div className="wheelFace" />
            <div className="wheelCenter" />
            <div className="wheelDot" />
          </div>
        </div>
      </div>

      <div style={{ height: 12 }} />

      {loading ? (
        <div className="small">Загружаю…</div>
      ) : err ? (
        <div className="small">
          <b>Ошибка:</b> {err}
        </div>
      ) : already ? (
        <>
          <div className="small" style={{ opacity: 0.9 }}>
            Ты уже крутил(а) сегодня. Снова можно через <b>{countdown}</b>
          </div>

          <div style={{ height: 10 }} />

          <button
            className="btn btnPrimary"
            style={{ width: "100%", borderRadius: 999 }}
            onClick={() => setOpen(true)}
            disabled={!card}
          >
            Какая карта выпала
          </button>

          <div style={{ height: 8 }} />

          <button className="btn btnGhost" style={{ width: "100%", borderRadius: 999 }} disabled>
            Вернуться через {countdown}
          </button>
        </>
      ) : (
        <button
          className="btn btnPrimary"
          style={{ width: "100%", borderRadius: 999 }}
          onClick={spin}
          disabled={!canSpin}
        >
          {spinning ? "Кручу…" : "Крутить колесо"}
        </button>
      )}

      <Modal open={open} title="Карта колеса" onClose={() => setOpen(false)}>
        {!card ? (
          <p className="text">…</p>
        ) : (
          <div className="row">
            <img className="img" src={card.image} alt={card.titleRu} loading="lazy" decoding="async" />
            <div className="col">
              <div className="title" style={{ fontSize: 16 }}>{card.titleRu}</div>
              <p className="text" style={{ marginTop: 8 }}>{card.meaningRu}</p>

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
