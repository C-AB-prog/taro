"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Modal } from "@/components/Modal";

type WheelCard = {
  slug: string;
  image: string;
  titleRu: string;
  meaningRu: string;
  adviceRu: string;
};

type StatusResp = {
  already: boolean;
  nextInMinutes?: number; // старое поле (может быть)
  card?: WheelCard;
};

type SpinResp = {
  already: boolean;
  nextInMinutes?: number; // старое поле (может быть)
  card: WheelCard;
};

const MSK_OFFSET_MS = 3 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

function nextMskMidnightUtcMs(now = Date.now()) {
  const mskNow = now + MSK_OFFSET_MS;
  const nextMidMsk = (Math.floor(mskNow / DAY_MS) + 1) * DAY_MS;
  return nextMidMsk - MSK_OFFSET_MS;
}

function fmtHMS(totalSeconds: number) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const hh = String(Math.floor(s / 3600)).padStart(2, "0");
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

async function ensureSessionClient() {
  try {
    const tg = (globalThis as any)?.Telegram?.WebApp;
    const initData = tg?.initData;
    if (!initData) return false;

    const r = await fetch("/api/auth/telegram", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ initData }),
    });
    const d = await r.json().catch(() => ({}));
    return !!(r.ok && d?.ok);
  } catch {
    return false;
  }
}

async function apiStatus(): Promise<StatusResp> {
  const r = await fetch("/api/wheel/status", {
    method: "GET",
    credentials: "include",
    cache: "no-store",
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) {
    const e = new Error(d?.error || "STATUS_FAILED");
    (e as any).status = r.status;
    throw e;
  }
  return d as StatusResp;
}

async function apiSpin(): Promise<SpinResp> {
  const r = await fetch("/api/wheel/spin", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    cache: "no-store",
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) {
    const e = new Error(d?.error || "SPIN_FAILED");
    (e as any).status = r.status;
    throw e;
  }
  return d as SpinResp;
}

function haptic(type: "light" | "success" | "error") {
  const h = (globalThis as any)?.Telegram?.WebApp?.HapticFeedback;
  try {
    if (type === "light") h?.impactOccurred?.("light");
    if (type === "success") h?.notificationOccurred?.("success");
    if (type === "error") h?.notificationOccurred?.("error");
  } catch {}
}

export function Wheel() {
  const size = useMemo(() => "min(320px, 84vw)", []);
  const wheelBg = useMemo(
    () =>
      [
        "radial-gradient(circle at 30% 25%, rgba(255,255,255,.95), rgba(255,255,255,.72) 35%, rgba(176,142,66,.14) 68%, rgba(26,22,16,.06) 100%)",
        "repeating-conic-gradient(from -15deg, rgba(176,142,66,.18) 0deg 8deg, rgba(26,22,16,.03) 8deg 16deg)",
      ].join(","),
    []
  );

  // состояние
  const [ready, setReady] = useState(false); // чтобы сразу не показывать “можно крутить”
  const [already, setAlready] = useState(false);
  const [card, setCard] = useState<WheelCard | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // таймер до следующего сброса (00:00 МСК)
  const [resetAtMs, setResetAtMs] = useState<number>(() => nextMskMidnightUtcMs());
  const [leftSec, setLeftSec] = useState<number>(() => Math.ceil((resetAtMs - Date.now()) / 1000));

  // анимация вращения
  const [rot, setRot] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const pendingRef = useRef<SpinResp | null>(null);

  // модалка
  const [open, setOpen] = useState(false);
  const [imgReady, setImgReady] = useState(false);

  // обновляем таймер каждую секунду, формат 00:00:00
  useEffect(() => {
    const id = setInterval(() => {
      const ra = nextMskMidnightUtcMs();
      setResetAtMs(ra);
      setLeftSec(Math.max(0, Math.ceil((ra - Date.now()) / 1000)));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  // при открытии — сразу узнаём статус (крутил/не крутил) и НЕ показываем “можно крутить” раньше времени
  useEffect(() => {
    let alive = true;

    (async () => {
      setErr(null);
      try {
        const st = await apiStatus().catch(async (e: any) => {
          if ((e?.status === 401 || e?.message === "UNAUTHORIZED") && (await ensureSessionClient())) {
            return await apiStatus();
          }
          throw e;
        });

        if (!alive) return;

        setAlready(!!st.already);
        setCard(st.already && st.card ? st.card : null);
      } catch {
        if (!alive) return;
        setErr("Не удалось проверить колесо. Попробуй обновить.");
      } finally {
        if (alive) setReady(true);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  const canSpin = ready && !spinning && !already;

  const subtitle = useMemo(() => {
    if (!ready) return "Проверяю…";
    if (already) return `Вы уже крутили сегодня • снова через ${fmtHMS(leftSec)}`;
    return `Можно крутить 1 раз в сутки • сброс через ${fmtHMS(leftSec)}`;
  }, [ready, already, leftSec]);

  async function openResultModal() {
    if (!card) return;
    setImgReady(false);
    setOpen(true); // ✅ открываем сразу, без ожидания загрузки (меньше лагов)
    haptic("light");
  }

  async function onSpin() {
    if (!canSpin) return;
    setErr(null);
    haptic("light");

    try {
      const res = await apiSpin().catch(async (e: any) => {
        if ((e?.status === 401 || e?.message === "UNAUTHORIZED") && (await ensureSessionClient())) {
          return await apiSpin();
        }
        throw e;
      });

      // если уже крутили — сразу фиксируем и показываем кнопку “Какая карта выпала”
      if (res.already) {
        setAlready(true);
        setCard(res.card);
        haptic("error");
        return;
      }

      pendingRef.current = res;
      setSpinning(true);

      // кручение: несколько оборотов + случайный угол
      const extra = 1440 + Math.floor(Math.random() * 360);
      setRot((v) => v + extra);
    } catch (e: any) {
      const status = e?.status;
      if (status === 401 || e?.message === "UNAUTHORIZED") {
        setErr("Нет сессии. Открой мини-приложение через Telegram.");
      } else {
        setErr("Не удалось прокрутить. Попробуй ещё раз.");
      }
      haptic("error");
    }
  }

  return (
    <div className="card">
      <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
        <div>
          <div className="title">Колесо фортуны</div>
          <div className="small">{subtitle}</div>
        </div>

        {ready && already && card ? (
          <button className="btn btnGhost" onClick={openResultModal} style={{ padding: "10px 12px", borderRadius: 999 }}>
            Какая карта выпала
          </button>
        ) : null}
      </div>

      {err ? (
        <>
          <div style={{ height: 10 }} />
          <div className="small">
            <b>Ошибка:</b> {err}
          </div>
        </>
      ) : null}

      <div style={{ height: 14 }} />

      <div style={{ display: "grid", justifyItems: "center", gap: 10 }}>
        {/* стрелка сверху */}
        <div style={{ color: "rgba(26,22,16,.85)" }} aria-hidden="true">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
            <path d="M12 3v13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <path d="M7 14l5 7 5-7" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
          </svg>
        </div>

        <motion.div
          style={{
            width: size,
            height: size,
            borderRadius: 999,
            position: "relative",
            background: wheelBg,
            border: "2px solid rgba(176,142,66,.66)",
            boxShadow: "0 16px 44px rgba(0,0,0,.08)",
            cursor: canSpin ? "pointer" : "default",
            touchAction: "manipulation",
            willChange: "transform",
          }}
          role="button"
          aria-label="Колесо"
          onClick={() => (canSpin ? onSpin() : undefined)}
          animate={{ rotate: rot }}
          transition={{
            duration: spinning ? 2.2 : 0,
            ease: [0.1, 0.9, 0.2, 1],
          }}
          onAnimationComplete={() => {
            if (!spinning) return;

            setSpinning(false);
            const res = pendingRef.current;
            pendingRef.current = null;

            if (res?.card) {
              setAlready(true);
              setCard(res.card);
              setImgReady(false);
              setOpen(true); // ✅ открываем сразу
              haptic("success");
            }
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 12,
              borderRadius: 999,
              border: "1px solid rgba(20,16,10,.10)",
              background: "rgba(255,255,255,.18)",
            }}
          />

          <div
            style={{
              position: "absolute",
              inset: "22%",
              borderRadius: 999,
              background: "rgba(255,255,255,.90)",
              border: "1px solid rgba(20,16,10,.12)",
              display: "grid",
              placeItems: "center",
              userSelect: "none",
            }}
          >
            <div className="small" style={{ fontWeight: 900, opacity: 0.92 }}>
              {spinning ? "✨" : already ? "✓" : "✨"}
            </div>
          </div>
        </motion.div>

        {/* кнопка: если уже крутили — показываем таймер прямо на кнопке */}
        <button
          className="btn btnPrimary"
          style={{ width: "100%", borderRadius: 999 }}
          onClick={onSpin}
          disabled={!canSpin}
        >
          {!ready
            ? "Проверяю…"
            : spinning
            ? "Кручу…"
            : already
            ? `Вернуться через ${fmtHMS(leftSec)}`
            : "Крутить колесо"}
        </button>
      </div>

      <Modal
        open={open}
        title={card?.titleRu ? `Колесо: ${card.titleRu}` : "Колесо"}
        onClose={() => setOpen(false)}
      >
        {!card ? (
          <p className="text">…</p>
        ) : (
          <div className="row">
            {/* ✅ мягкая подгрузка картинки: сначала “плашка”, потом fade-in */}
            <div
              style={{
                width: 160,
                height: 220,
                borderRadius: 18,
                position: "relative",
                overflow: "hidden",
                background: "rgba(20,16,10,.06)",
                border: "1px solid rgba(20,16,10,.08)",
                flex: "0 0 auto",
              }}
            >
              {!imgReady ? (
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    background:
                      "linear-gradient(90deg, rgba(255,255,255,.5), rgba(255,255,255,.85), rgba(255,255,255,.5))",
                    animation: "shimmer 1.1s infinite linear",
                    opacity: 0.55,
                  }}
                />
              ) : null}

              <img
                src={card.image}
                alt={card.titleRu}
                loading="eager"
                decoding="async"
                onLoad={() => setImgReady(true)}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  display: "block",
                  opacity: imgReady ? 1 : 0,
                  transition: "opacity 220ms ease",
                }}
              />
            </div>

            <div className="col">
              <div className="title" style={{ fontSize: 16 }}>
                {card.titleRu}
              </div>

              <div className="small" style={{ marginTop: 2 }}>
                Что означает
              </div>
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
