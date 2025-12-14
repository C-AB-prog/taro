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
  nextInMinutes?: number;
  card?: WheelCard;
};

type SpinResp = {
  already: boolean;
  nextInMinutes?: number;
  card: WheelCard;
};

function fmtCountdownRu(mins: number) {
  const m = Math.max(0, Math.floor(mins));
  const h = Math.floor(m / 60);
  const mm = m % 60;

  if (h <= 0) return `${mm} мин`;
  if (mm === 0) return `${h} ч`;
  return `${h} ч ${mm} мин`;
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

async function preloadImage(src?: string) {
  if (!src) return;
  try {
    const img = new Image();
    img.src = src;
    // decode() заметно уменьшает “лаг” при открытии модалки на телефонах
    // (если браузер поддерживает)
    // @ts-ignore
    if (img.decode) await img.decode();
  } catch {}
}

export function Wheel() {
  const size = useMemo(() => "min(320px, 84vw)", []);

  const [loading, setLoading] = useState(true);
  const [already, setAlready] = useState(false);
  const [cooldownMins, setCooldownMins] = useState<number | null>(null);

  const [card, setCard] = useState<WheelCard | null>(null);

  const [open, setOpen] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [rot, setRot] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const pendingRef = useRef<SpinResp | null>(null);

  function haptic(type: "light" | "success" | "error") {
    const h = (globalThis as any)?.Telegram?.WebApp?.HapticFeedback;
    try {
      if (type === "light") h?.impactOccurred?.("light");
      if (type === "success") h?.notificationOccurred?.("success");
      if (type === "error") h?.notificationOccurred?.("error");
    } catch {}
  }

  // 1) при открытии страницы сразу узнаём: уже крутили или нет
  useEffect(() => {
    let alive = true;

    (async () => {
      setLoading(true);
      setErr(null);

      try {
        let st = await apiStatus().catch(async (e: any) => {
          if ((e?.status === 401 || e?.message === "UNAUTHORIZED") && (await ensureSessionClient())) {
            return await apiStatus();
          }
          throw e;
        });

        if (!alive) return;

        setAlready(!!st.already);
        setCooldownMins(typeof st.nextInMinutes === "number" ? st.nextInMinutes : null);

        if (st.already && st.card) {
          setCard(st.card);
          // заранее прогреем картинку, чтобы модалка открывалась без рывка
          preloadImage(st.card.image);
        } else {
          setCard(null);
        }
      } catch (e: any) {
        if (!alive) return;
        setErr("Не удалось проверить колесо. Попробуй обновить.");
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  // 2) обновляем таймер раз в минуту (если есть)
  useEffect(() => {
    if (cooldownMins == null) return;
    const id = setInterval(() => {
      setCooldownMins((m) => (m == null ? null : Math.max(0, m - 1)));
    }, 60_000);
    return () => clearInterval(id);
  }, [cooldownMins]);

  async function openResultModal() {
    if (!card) return;
    await preloadImage(card.image);
    requestAnimationFrame(() => setOpen(true));
    haptic("light");
  }

  async function onSpin() {
    if (spinning) return;

    setErr(null);
    haptic("light");

    try {
      const res = await apiSpin().catch(async (e: any) => {
        if ((e?.status === 401 || e?.message === "UNAUTHORIZED") && (await ensureSessionClient())) {
          return await apiSpin();
        }
        throw e;
      });

      setCooldownMins(typeof res.nextInMinutes === "number" ? res.nextInMinutes : null);

      // если уже крутили — НЕ открываем модалку сами
      if (res.already) {
        setAlready(true);
        setCard(res.card);
        preloadImage(res.card.image);
        haptic("error");
        return;
      }

      // новый спин — делаем анимацию, а модалку покажем после остановки
      pendingRef.current = res;
      setSpinning(true);

      // красивое кручение (несколько оборотов)
      const extra = 1440 + Math.floor(Math.random() * 360);
      setRot((v) => v + extra);
    } catch (e: any) {
      const status = e?.status;
      if (status === 401 || e?.message === "UNAUTHORIZED") setErr("Нет сессии. Открой мини-приложение через Telegram.");
      else setErr("Не удалось прокрутить. Попробуй ещё раз.");
      haptic("error");
    }
  }

  const canSpin = !loading && !spinning && !already;

  const subtitle = useMemo(() => {
    if (loading) return "Проверяю…";
    if (already) return `Вы уже крутили сегодня • вернуться через ${fmtCountdownRu(cooldownMins ?? 0)}`;
    return "Можно крутить 1 раз в сутки";
  }, [loading, already, cooldownMins]);

  // дизайн колеса (минимал + золото, без “золотой блямбы”)
  const wheelBg = useMemo(
    () =>
      [
        "radial-gradient(circle at 30% 25%, rgba(255,255,255,.92), rgba(255,255,255,.70) 35%, rgba(176,142,66,.14) 68%, rgba(26,22,16,.06) 100%)",
        "repeating-conic-gradient(from -15deg, rgba(176,142,66,.18) 0deg 8deg, rgba(26,22,16,.03) 8deg 16deg)",
      ].join(","),
    []
  );

  return (
    <div className="card">
      <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline", gap: 10 }}>
        <div>
          <div className="title">Колесо фортуны</div>
          <div className="small">{subtitle}</div>
        </div>

        {already && card ? (
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

      {/* стрелка сверху */}
      <div style={{ display: "grid", justifyItems: "center", gap: 10 }}>
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
          }}
          role="button"
          aria-label="Колесо"
          onClick={() => (canSpin ? onSpin() : undefined)}
          animate={{ rotate: rot }}
          transition={{
            duration: spinning ? 2.2 : 0,
            ease: [0.1, 0.9, 0.2, 1],
          }}
          onAnimationComplete={async () => {
            if (!spinning) return;

            setSpinning(false);
            const res = pendingRef.current;
            pendingRef.current = null;

            if (res?.card) {
              setAlready(true);
              setCard(res.card);
              await preloadImage(res.card.image);
              setOpen(true);
              haptic("success");
            }
          }}
        >
          {/* внутренний обод */}
          <div
            style={{
              position: "absolute",
              inset: 12,
              borderRadius: 999,
              border: "1px solid rgba(20,16,10,.10)",
              background: "rgba(255,255,255,.18)",
            }}
          />

          {/* центр */}
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

        <button className="btn btnPrimary" style={{ width: "100%", borderRadius: 999 }} onClick={onSpin} disabled={!canSpin}>
          {loading ? "Проверяю…" : spinning ? "Кручу…" : already ? "Сегодня уже крутили" : "Крутить колесо"}
        </button>

        {already && cooldownMins != null && cooldownMins > 0 ? (
          <div className="small" style={{ opacity: 0.9 }}>
            Вернуться через <b>{fmtCountdownRu(cooldownMins)}</b>
          </div>
        ) : null}
      </div>

      <Modal open={open} title={card?.titleRu ? `Колесо: ${card.titleRu}` : "Колесо"} onClose={() => setOpen(false)}>
        {!card ? (
          <p className="text">…</p>
        ) : (
          <div className="row">
            <img
              className="img"
              src={card.image}
              alt={card.titleRu}
              loading="eager"
              decoding="async"
              style={{ borderRadius: 18, objectFit: "cover" }}
            />
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
