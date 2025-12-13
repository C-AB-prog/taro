"use client";

import { useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Modal } from "@/components/Modal";

type WheelCard = {
  slug: string;
  image: string;
  titleRu: string;
  meaningRu: string;
  adviceRu: string;
};

function minutesUntilNextDay() {
  const now = new Date();
  const next = new Date(now);
  next.setHours(24, 0, 0, 0);
  const mins = Math.ceil((next.getTime() - now.getTime()) / 60000);
  return Math.max(0, mins);
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

async function apiSpin(): Promise<{ already: boolean; card: WheelCard }> {
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
  return { already: !!d?.already, card: d?.card as WheelCard };
}

export function Wheel() {
  const size = useMemo(() => "min(320px, 84vw)", []);

  const [rot, setRot] = useState(0);
  const [spinning, setSpinning] = useState(false);

  const pendingRef = useRef<{ already: boolean; card: WheelCard } | null>(null);

  const [card, setCard] = useState<WheelCard | null>(null);
  const [open, setOpen] = useState(false);

  const [info, setInfo] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

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
    setInfo(null);
    haptic("light");

    try {
      let res = await apiSpin().catch(async (e: any) => {
        if ((e?.status === 401 || e?.message === "UNAUTHORIZED") && (await ensureSessionClient())) {
          return await apiSpin();
        }
        throw e;
      });

      // уже крутили сегодня — не крутим анимацию, просто показываем
      if (res.already) {
        setCard(res.card);
        setOpen(true);
        setInfo(`Сегодня уже крутили. Вернись через ${minutesUntilNextDay()} мин.`);
        return;
      }

      // иначе — запускаем анимацию и откроем результат после остановки
      pendingRef.current = res;
      setSpinning(true);
      setInfo("Крутим…");

      const extra = 1440 + Math.floor(Math.random() * 360); // 4+ оборота
      setRot((v) => v + extra);
    } catch (e: any) {
      const status = e?.status;
      if (status === 401 || e?.message === "UNAUTHORIZED") {
        setErr("Нет сессии. Открой мини-приложение через Telegram и попробуй ещё раз.");
      } else {
        setErr("Не удалось прокрутить. Попробуй ещё раз.");
      }
      setInfo(null);
      haptic("error");
    }
  }

  function openResult() {
    if (!card) return;
    setOpen(true);
    haptic("light");
  }

  // минималистичный “диск” с делениями (чёрно-золото, но светлая тема)
  const diskBg = useMemo(
    () =>
      "repeating-conic-gradient(from -18deg, rgba(176,142,66,.26) 0deg 12deg, rgba(26,22,16,.04) 12deg 24deg)",
    []
  );

  return (
    <div className="card">
      <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline" }}>
        <div>
          <div className="title">Колесо фортуны</div>
          <div className="small">Крути 1 раз в сутки</div>
        </div>

        {card ? (
          <button className="btn btnGhost" onClick={openResult} style={{ padding: "10px 12px" }}>
            Какая карта выпала?
          </button>
        ) : (
          <div className="small" style={{ opacity: 0.75 }}>
            —
          </div>
        )}
      </div>

      <div style={{ height: 12 }} />

      {/* стрелка НАД колесом (вниз) */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
        <div style={{ marginBottom: 10, color: "rgba(26,22,16,.85)" }} aria-hidden="true">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
            <path d="M12 3v13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            <path d="M7 14l5 7 5-7" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
          </svg>
        </div>

        <motion.div
          role="button"
          aria-label="Колесо фортуны"
          onClick={onSpin}
          style={{
            width: size,
            height: size,
            borderRadius: 999,
            position: "relative",
            background: diskBg,
            border: "2px solid rgba(176,142,66,.70)",
            boxShadow: "0 16px 44px rgba(0,0,0,.08)",
            touchAction: "manipulation",
            cursor: spinning ? "default" : "pointer",
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
              setInfo(null);
              haptic("success");
            }
          }}
        >
          {/* внешний “обод” */}
          <div
            style={{
              position: "absolute",
              inset: 10,
              borderRadius: 999,
              border: "1px solid rgba(26,22,16,.10)",
              background: "rgba(255,255,255,.22)",
            }}
          />
          {/* центр */}
          <div
            style={{
              position: "absolute",
              inset: "18%",
              borderRadius: 999,
              background: "rgba(255,255,255,.86)",
              border: "1px solid rgba(20,16,10,.12)",
              display: "grid",
              placeItems: "center",
              userSelect: "none",
            }}
          >
            <div style={{ textAlign: "center", padding: 10 }}>
              <div className="small" style={{ fontWeight: 900 }}>
                {spinning ? "…" : "Тап"}
              </div>
              <div className="small" style={{ opacity: 0.8, whiteSpace: "pre-line" }}>
                {spinning ? "кручу" : "чтобы\nкрутить"}
              </div>
            </div>
          </div>
        </motion.div>

        <div style={{ height: 12 }} />

        <button className="btn btnPrimary" style={{ width: "100%" }} onClick={onSpin} disabled={spinning}>
          {spinning ? "Крутим…" : "Крутить колесо"}
        </button>

        {info ? <div className="small" style={{ marginTop: 10 }}>{info}</div> : null}
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

              <div className="small" style={{ marginTop: 10, opacity: 0.85 }}>
                Следующая попытка через {minutesUntilNextDay()} мин.
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
