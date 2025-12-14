"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Modal } from "@/components/Modal";

type WheelCard = {
  slug: string;
  titleRu: string;
  meaningRu: string;
  adviceRu: string;
  image: string;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function getInitDataWithWait(timeoutMs = 2000): Promise<string> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const tg = (globalThis as any)?.Telegram?.WebApp;
    const initData = tg?.initData;
    if (typeof initData === "string" && initData.length > 0) return initData;
    await sleep(80);
  }
  return "";
}

function pad2(n: number) {
  return String(Math.max(0, n)).padStart(2, "0");
}
function fmtHms(msLeft: number) {
  const s = Math.max(0, Math.floor(msLeft / 1000));
  const hh = Math.floor(s / 3600);
  const mm = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  return `${pad2(hh)}:${pad2(mm)}:${pad2(ss)}`;
}

export function Wheel() {
  const [loading, setLoading] = useState(true);
  const [already, setAlready] = useState(false);
  const [nextInMinutes, setNextInMinutes] = useState<number>(0);
  const [card, setCard] = useState<WheelCard | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const [open, setOpen] = useState(false);

  const [spinning, setSpinning] = useState(false);
  const [deg, setDeg] = useState(0);

  const [msLeft, setMsLeft] = useState(0);
  const tickRef = useRef<any>(null);

  const msInitial = useMemo(() => nextInMinutes * 60_000, [nextInMinutes]);

  useEffect(() => {
    setMsLeft(msInitial);
  }, [msInitial]);

  useEffect(() => {
    if (tickRef.current) clearInterval(tickRef.current);
    if (!already) return;

    tickRef.current = setInterval(() => {
      setMsLeft((prev) => Math.max(0, prev - 1000));
    }, 1000);

    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, [already]);

  async function loadState() {
    setLoading(true);
    setErr(null);

    try {
      const initData = await getInitDataWithWait(2500);
      const r = await fetch("/api/wheel/state", {
        method: "GET",
        cache: "no-store",
        credentials: "include",
        headers: initData ? { "x-telegram-init-data": initData } : undefined,
      });

      const d = await r.json().catch(() => ({}));

      if (!r.ok) {
        if (r.status === 401) setErr("Открой мини-приложение через Telegram.");
        else setErr("Не удалось загрузить колесо. Попробуй ещё раз.");
        setLoading(false);
        return;
      }

      setAlready(!!d?.already);
      setNextInMinutes(Number(d?.nextInMinutes) || 0);
      setCard(d?.card ?? null);

      setLoading(false);
    } catch {
      setErr("Ошибка сети. Попробуй ещё раз.");
      setLoading(false);
    }
  }

  useEffect(() => {
    loadState();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function spin() {
    if (spinning || loading) return;

    setErr(null);

    // запускаем анимацию
    setSpinning(true);
    setDeg((prev) => prev + 1440 + Math.floor(Math.random() * 360));

    try {
      const initData = await getInitDataWithWait(2500);
      const r = await fetch("/api/wheel/spin", {
        method: "POST",
        cache: "no-store",
        credentials: "include",
        headers: initData ? { "x-telegram-init-data": initData } : undefined,
      });

      const d = await r.json().catch(() => ({}));

      if (!r.ok) {
        if (r.status === 401) setErr("Открой мини-приложение через Telegram.");
        else setErr("Не удалось прокрутить. Попробуй ещё раз.");
        setSpinning(false);
        return;
      }

      const nextMin = Number(d?.nextInMinutes) || 0;

      // дождёмся конца анимации (чтобы было приятно)
      setTimeout(() => {
        setAlready(!!d?.already || true);
        setNextInMinutes(nextMin);
        setCard(d?.card ?? null);
        setSpinning(false);

        // сразу показываем кнопку + модалку с картой
        if (d?.card) {
          setOpen(true);
          (globalThis as any)?.Telegram?.WebApp?.HapticFeedback?.notificationOccurred?.("success");
        }
      }, 900);
    } catch {
      setErr("Ошибка сети. Попробуй ещё раз.");
      setSpinning(false);
    }
  }

  return (
    <div className="card">
      <div className="title" style={{ fontSize: 16 }}>Колесо фортуны</div>
      <div className="small" style={{ marginTop: 4 }}>
        Один раз в сутки — и карта откроет подсказку.
      </div>

      <div style={{ height: 10 }} />

      <div className="wheelMinimal">
        <div className="wheelPointerDown" />
        <div className="wheelRing">
          <div
            className="wheelSpin"
            style={{
              transform: `rotate(${deg}deg)`,
              transition: spinning ? "transform 900ms cubic-bezier(.2,.9,.2,1)" : "transform 0ms",
              willChange: "transform",
            }}
          >
            <div className="wheelFace" />
          </div>
          <div className="wheelCenter" />
          <div className="wheelDot" />
        </div>
      </div>

      <div style={{ height: 12 }} />

      {err ? (
        <div className="small">
          <b>Ошибка:</b> {err}
        </div>
      ) : null}

      <div style={{ height: err ? 10 : 0 }} />

      {loading ? (
        <button className="btn btnPrimary" style={{ width: "100%", borderRadius: 999 }} disabled>
          Загружаю…
        </button>
      ) : already ? (
        <>
          <div className="small" style={{ marginBottom: 10 }}>
            Ты уже кру(ти)л(а) сегодня. Снова можно через <b>{fmtHms(msLeft)}</b>
          </div>

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
            Вернуться через {fmtHms(msLeft)}
          </button>
        </>
      ) : (
        <button className="btn btnPrimary" style={{ width: "100%", borderRadius: 999 }} onClick={spin} disabled={spinning}>
          {spinning ? "Кручу…" : "Крутить колесо"}
        </button>
      )}

      <Modal open={open} title={card ? card.titleRu : "Карта"} onClose={() => setOpen(false)}>
        {!card ? (
          <p className="text">…</p>
        ) : (
          <div className="row">
            <img className="img" src={card.image} alt={card.titleRu} loading="lazy" decoding="async" />
            <div className="col">
              <div className="title" style={{ fontSize: 16 }}>{card.titleRu}</div>
              <div className="small" style={{ marginTop: 2 }}>Что означает</div>

              <p className="text" style={{ marginTop: 8 }}>
                {card.meaningRu}
              </p>

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
