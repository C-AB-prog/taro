"use client";

import { useMemo, useRef, useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Modal } from "@/components/Modal";

type WheelCard = {
  slug: string;
  image: string;
  titleRu: string;
  meaningRu: string;
  adviceRu: string;
};

type SpinResp = {
  already: boolean;
  nextInMinutes?: number;
  card: WheelCard;
};

function fmtCountdown(mins: number) {
  const m = Math.max(0, mins);
  const hh = Math.floor(m / 60);
  const mm = m % 60;
  const pad = (x: number) => String(x).padStart(2, "0");
  return hh > 0 ? `${hh}:${pad(mm)} ч` : `${mm} мин`;
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

export function Wheel() {
  const size = useMemo(() => "min(320px, 84vw)", []);
  const diskBg = useMemo(
    () =>
      "repeating-conic-gradient(from -18deg, rgba(176,142,66,.22) 0deg 12deg, rgba(26,22,16,.035) 12deg 24deg)",
    []
  );

  const [rot, setRot] = useState(0);
  const [spinning, setSpinning] = useState(false);

  const pendingRef = useRef<SpinResp | null>(null);

  const [card, setCard] = useState<WheelCard | null>(null);
  const [open, setOpen] = useState(false);

  const [cooldownMins, setCooldownMins] = useState<number | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // обновляем отображение таймера раз в минуту (если есть)
  useEffect(() => {
    if (cooldownMins == null) return;
    const id = setInterval(() => {
      setCooldownMins((m) => (m == null ? null : Math.max(0, m - 1)));
    }, 60_000);
    return () => clearInterval(id);
  }, [cooldownMins]);

  function haptic(type: "light" | "success" | "error") {
    const h = (globalThis as any)?.Telegram?.WebApp?.HapticFeedback;
    try {
      if (type === "light") h?.impactOccurred?.("light");
      if (type === "success") h?.notificationOccurred?.("success");
      if (type === "error") h?.notificationOccurred?.("error");
    } catch {}
  }

  async function onSpin() {
    if (spinning) return;

    setErr(null);
    setStatus(null);
    haptic("light");

    try {
      let res = await apiSpin().catch(async (e: any) => {
        if ((e?.status === 401 || e?.message === "UNAUTHORIZED") && (await ensureSessionClient())) {
          return await apiSpin();
        }
        throw e;
      });

      setCooldownMins(typeof res.nextInMinutes === "number" ? res.nextInMinutes : null);

      // already → без анимации
      if (res.already) {
        setCard(res.card);
        setOpen(true);
        setStatus(res.nextInMinutes ? `Сегодня уже крутили. Вернись через ${fmtCountdown(res.nextInMinutes)}.` : "Сегодня уже крутили.");
        return;
      }

      // запускаем анимацию и покажем после остановки
      pendingRef.current = res;
      setSpinning(true);
      setStatus("Кручу колесо…");

      const extra = 1440 + Math.floor(Math.random() * 360);
      setRot((v) => v + extra);
    } catch (e: any) {
      const status = e?.status;
      if (status === 401 || e?.message === "UNAUTHORIZED") setErr("Нет сессии. Открой мини-приложение через Telegram.");
      else setErr("Не удалось прокрутить. Попробуй ещё раз.");
      haptic("error");
    }
  }

  function openResult() {
    if (!card) return;
    setOpen(true);
    haptic("light");
  }

  const disabled = spinning || (cooldownMins != null && cooldownMins > 0 && card != null);

  return (
    <div className="card">
      <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
        <div>
          <div className="title">Колесо фортуны</div>
          <div className="small">
            {cooldownMins != null && cooldownMins > 0
              ? `Вернуться через ${fmtCountdown(cooldownMins)}`
              : "Можно крутить 1 раз в сутки"}
          </div>
        </div>

        {card ? (
          <button className="btn btnGhost" onClick={openResult} style={{ padding: "10px 12px", borderRadius: 999 }}>
            Карта выпала
          </button>
        ) : null}
      </div>

      <div style={{ height: 12 }} />

      {/* стрелка над колесом */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
        <div style={{ marginBottom: 10, color: "rgba(26,22,16,.85)" }} aria-hidden="true">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
            <path d="M12 3v13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <path d="M7 14l5 7 5-7" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
          </svg>
        </div>

        <motion.div
          role="button"
          aria-label="Колесо"
          onClick={() => {
            if (!disabled) onSpin();
          }}
          style={{
            width: size,
            height: size,
            borderRadius: 999,
            position: "relative",
            background: diskBg,
            border: "2px solid rgba(176,142,66,.70)",
            boxShadow: "0 16px 44px rgba(0,0,0,.08)",
            cursor: disabled ? "default" : "pointer",
            touchAction: "manipulation",
          }}
          animate={{ rotate: rot }}
          transition={{
            duration: spinning ? 2.25 : 0,
            ease: [0.1, 0.9, 0.2, 1],
          }}
          onAnimationComplete={() => {
            if (!spinning) return;
            setSpinning(false);

            const res = pendingRef.current;
            pendingRef.current = null;

            if (res?.card) {
              setCard(res.card);
              setOpen(true);
              setStatus(null);
              haptic("success");
            }
          }}
        >
          {/* обод */}
          <div
            style={{
              position: "absolute",
              inset: 10,
              borderRadius: 999,
              border: "1px solid rgba(26,22,16,.10)",
              background: "rgba(255,255,255,.20)",
            }}
          />
          {/* центр (без “тап”) */}
          <div
            style={{
              position: "absolute",
              inset: "18%",
              borderRadius: 999,
              background: "rgba(255,255,255,.88)",
              border: "1px solid rgba(20,16,10,.12)",
              display: "grid",
              placeItems: "center",
              userSelect: "none",
            }}
          >
            <div className="small" style={{ fontWeight: 900, opacity: 0.9 }}>
              ✨
            </div>
          </div>
        </motion.div>

        <div style={{ height: 12 }} />

        <button className="btn btnPrimary" style={{ width: "100%" }} onClick={onSpin} disabled={disabled}>
          {spinning ? "Кручу…" : cooldownMins != null && cooldownMins > 0 && card ? `Вернись через ${fmtCountdown(cooldownMins)}` : "Крутить колесо"}
        </button>

        {status ? <div className="small" style={{ marginTop: 10 }}>{status}</div> : null}
        {err ? (
          <div className="small" style={{ marginTop: 10 }}>
            <b>Ошибка:</b> {err}
          </div>
        ) : null}
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
            <img className="img" src={card.image} alt={card.titleRu} loading="lazy" decoding="async" />
            <div className="col">
              <div className="title" style={{ fontSize: 16 }}>{card.titleRu}</div>

              <div className="small" style={{ marginTop: 2 }}>Что означает</div>
              <p className="text" style={{ marginTop: 8 }}>{card.meaningRu}</p>

              <div className="adviceBox" style={{ marginTop: 12 }}>
                <div className="adviceTitle">Совет</div>
                <div className="adviceText">{card.adviceRu}</div>
              </div>

              {cooldownMins != null && cooldownMins > 0 ? (
                <div className="small" style={{ marginTop: 10, opacity: 0.85 }}>
                  Вернуться через {fmtCountdown(cooldownMins)}
                </div>
              ) : null}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
