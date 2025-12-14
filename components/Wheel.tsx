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

type StatusResp = { already: boolean; card?: WheelCard };
type SpinResp = { already: boolean; card: WheelCard };

const MSK_OFFSET_MS = 3 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

function nextMskMidnightUtcMs(now = Date.now()) {
  const mskNow = now + MSK_OFFSET_MS;
  const nextMidMsk = (Math.floor(mskNow / DAY_MS) + 1) * DAY_MS;
  return nextMidMsk - MSK_OFFSET_MS;
}

function hmsParts(totalSeconds: number) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const hh = String(Math.floor(s / 3600)).padStart(2, "0");
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return { hh, mm, ss, txt: `${hh} ${mm} ${ss}` }; // стиль 00 00 00
}

function haptic(type: "light" | "success" | "error") {
  const h = (globalThis as any)?.Telegram?.WebApp?.HapticFeedback;
  try {
    if (type === "light") h?.impactOccurred?.("light");
    if (type === "success") h?.notificationOccurred?.("success");
    if (type === "error") h?.notificationOccurred?.("error");
  } catch {}
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
  const r = await fetch("/api/wheel/status", { credentials: "include", cache: "no-store" });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) {
    const e = new Error(d?.error || "STATUS_FAILED");
    (e as any).status = r.status;
    throw e;
  }
  return d as StatusResp;
}

async function apiSpin(): Promise<SpinResp> {
  const r = await fetch("/api/wheel/spin", { method: "POST", credentials: "include", cache: "no-store" });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) {
    const e = new Error(d?.error || "SPIN_FAILED");
    (e as any).status = r.status;
    throw e;
  }
  return d as SpinResp;
}

export function Wheel() {
  // статус
  const [ready, setReady] = useState(false);       // ✅ пока false — НЕ показываем “можно крутить”
  const [needTg, setNeedTg] = useState(false);     // ✅ если нет сессии
  const [already, setAlready] = useState(false);
  const [card, setCard] = useState<WheelCard | null>(null);
  const [err, setErr] = useState<string | null>(null);

  // таймер (только на кнопке)
  const [leftSec, setLeftSec] = useState(() => Math.ceil((nextMskMidnightUtcMs() - Date.now()) / 1000));

  // вращение
  const [rot, setRot] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const pendingRef = useRef<SpinResp | null>(null);

  // модалка
  const [open, setOpen] = useState(false);
  const [imgReady, setImgReady] = useState(false);

  // таймер обновляем раз в секунду
  useEffect(() => {
    const id = setInterval(() => {
      setLeftSec(Math.max(0, Math.ceil((nextMskMidnightUtcMs() - Date.now()) / 1000)));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  // ✅ при входе сразу узнаём “крутил/не крутил”
  useEffect(() => {
    let alive = true;

    (async () => {
      setErr(null);
      setNeedTg(false);
      setReady(false);

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
      } catch (e: any) {
        if (!alive) return;

        if (e?.status === 401 || e?.message === "UNAUTHORIZED") {
          setNeedTg(true);
          setErr("Нет сессии. Открой мини-приложение через Telegram.");
        } else if (e?.status === 404) {
          setErr("Не найден /api/wheel/status (добавь endpoint и задеплой).");
        } else {
          setErr("Не удалось загрузить статус колеса. Обнови страницу.");
        }
      } finally {
        if (alive) setReady(true);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  const t = useMemo(() => hmsParts(leftSec), [leftSec]);

  // ✅ крутить можно ТОЛЬКО когда статус загрузился и нет “already/needTg”
  const canSpin = ready && !needTg && !spinning && !already;

  // ✅ верхний текст без времени (чтобы не дублировалось)
  const subtitle = useMemo(() => {
    if (!ready) return "Проверяю статус…";
    if (needTg) return "Открой мини-приложение через Telegram";
    if (already) return "Вы уже крутили сегодня";
    return "Можно крутить 1 раз в сутки";
  }, [ready, needTg, already]);

  function openResult() {
    if (!card) return;
    setImgReady(false);
    setOpen(true); // ✅ открываем сразу, картинка подтянется мягко внутри
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

      // если вдруг сервер сказал “уже крутил”
      if (res.already) {
        setAlready(true);
        setCard(res.card);
        haptic("error");
        return;
      }

      pendingRef.current = res;
      setSpinning(true);
      setRot((v) => v + 1440 + Math.floor(Math.random() * 360));
    } catch (e: any) {
      const status = e?.status;
      if (status === 401 || e?.message === "UNAUTHORIZED") {
        setNeedTg(true);
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

        {/* ✅ кнопка появляется сразу, если уже крутил и карта есть */}
        {ready && already && card ? (
          <button className="btn btnGhost" onClick={openResult} style={{ padding: "10px 12px", borderRadius: 999 }}>
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

      <div className="wheelMinimal">
        <div className="wheelPointerDown" />
        <div className="wheelRing">
          <motion.div
            className="wheelSpin"
            animate={{ rotate: rot }}
            transition={{ duration: spinning ? 2.2 : 0, ease: [0.1, 0.9, 0.2, 1] }}
            onAnimationComplete={() => {
              if (!spinning) return;
              setSpinning(false);

              const res = pendingRef.current;
              pendingRef.current = null;

              if (res?.card) {
                setAlready(true);
                setCard(res.card);
                setImgReady(false);
                setOpen(true); // ✅ новый спин — сразу показываем результат
                haptic("success");
              }
            }}
          >
            <div className="wheelFace" />
          </motion.div>

          <div className="wheelCenter">
            <div className="wheelDot" />
          </div>
        </div>
      </div>

      {/* ✅ время только на кнопке (когда уже крутил) */}
      <button
        className="btn btnPrimary"
        style={{ width: "100%", borderRadius: 999 }}
        onClick={onSpin}
        disabled={!canSpin}
      >
        {!ready
          ? "Проверяю…"
          : needTg
          ? "Нет сессии"
          : spinning
          ? "Кручу…"
          : already
          ? `Вернуться через ${t.txt}`
          : "Крутить колесо"}
      </button>

      <Modal open={open} title={card?.titleRu ? `Колесо: ${card.titleRu}` : "Колесо"} onClose={() => setOpen(false)}>
        {!card ? (
          <p className="text">…</p>
        ) : (
          <div className="row">
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
              {!imgReady ? <div className="shimmer" style={{ position: "absolute", inset: 0 }} /> : null}
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
              <div className="title" style={{ fontSize: 16 }}>{card.titleRu}</div>

              <div className="small" style={{ marginTop: 2 }}>Что означает</div>
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
