"use client";

import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { RitualHeader } from "@/components/RitualHeader";

type Offer = {
  id: string;
  title: string;
  url: string;
  reward: number;
  claimed?: boolean;
};

function getBotUsername() {
  return (process.env.NEXT_PUBLIC_BOT_USERNAME || "").replace(/^@/, "").trim();
}

function buildReferralBotLink(userId: string) {
  const bot = getBotUsername();
  if (!bot || !userId) return "";
  return `https://t.me/${bot}?start=ref_${encodeURIComponent(userId)}`;
}

function openTgLink(url: string) {
  const tg = (globalThis as any)?.Telegram?.WebApp;
  try {
    if (tg?.openTelegramLink) return tg.openTelegramLink(url);
    if (tg?.openLink) return tg.openLink(url);
  } catch {}
  window.open(url, "_blank");
}

function shareLink(url: string) {
  const text = "✨ Забирай бонус и смотри «Карту дня» в Daily Tarot!";
  const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`;
  openTgLink(shareUrl);
}

export default function FreePage() {
  const [userId, setUserId] = useState<string>("");
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [needTg, setNeedTg] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const refLink = useMemo(() => buildReferralBotLink(userId), [userId]);

  async function load() {
    setLoading(true);
    setErr(null);
    setNeedTg(false);

    try {
      // 1) userId (для реф-ссылки)
      const me = await fetch("/api/me", { cache: "no-store", credentials: "include" });
      if (me.status === 401) {
        setNeedTg(true);
      } else {
        const meJson = await me.json().catch(() => ({}));
        const id = String(meJson?.user?.id || "");
        if (id) setUserId(id);
      }

      // 2) офферы
      const r = await fetch("/api/free/offers", { cache: "no-store", credentials: "include" });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d?.ok) {
        setErr("Не удалось загрузить предложения. Попробуй позже.");
        setOffers([]);
      } else {
        setOffers(Array.isArray(d.offers) ? d.offers : []);
      }
    } catch {
      setErr("Ошибка сети. Попробуй позже.");
      setOffers([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setToast("Ссылка скопирована ✅");
      setTimeout(() => setToast(null), 1200);
    } catch {
      // универсальный fallback
      const ok = window.prompt("Скопируй ссылку:", text);
      if (ok !== null) {
        setToast("Скопируй и отправь другу ✅");
      } else {
        setToast("Не получилось скопировать. Нажми «Поделиться».");
      }
      setTimeout(() => setToast(null), 1600);
    }
  }

  async function claimOffer(offerId: string) {
    if (claimingId) return;
    setClaimingId(offerId);
    setToast(null);

    try {
      const r = await fetch("/api/free/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        cache: "no-store",
        body: JSON.stringify({ offerId }),
      });

      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d?.ok) {
        setToast(d?.error === "ALREADY" ? "Ты уже забирал бонус за этот канал." : "Не получилось получить бонус. Попробуй ещё раз.");
        setTimeout(() => setToast(null), 1600);
        return;
      }

      setToast(`Готово! +${d.reward} валюты ✨`);
      setTimeout(() => setToast(null), 1400);

      window.dispatchEvent(new Event("balance:refresh"));
      await load();
    } catch {
      setToast("Ошибка сети. Попробуй ещё раз.");
      setTimeout(() => setToast(null), 1600);
    } finally {
      setClaimingId(null);
    }
  }

  return (
    <AppShell>
      <RitualHeader label="Бесплатно" />

      {/* Пригласить друга */}
      <div className="card">
        <div className="title" style={{ fontSize: 16 }}>Пригласи друга</div>
        <div className="small" style={{ marginTop: 6 }}>
          За каждого нового друга (который зайдёт в приложение впервые) ты получишь <b>+500</b> валюты.
        </div>

        {needTg ? (
          <>
            <div style={{ height: 10 }} />
            <div className="small">
              Чтобы работали приглашения и начисления — открой мини-приложение через Telegram (кнопкой в боте).
            </div>
          </>
        ) : null}

        <div style={{ height: 12 }} />

        <button
          className="btn btnPrimary"
          style={{ width: "100%", borderRadius: 999 }}
          onClick={() => {
            if (!refLink) {
              setToast("Не удалось создать ссылку. Открой мини-приложение через Telegram и попробуй снова.");
              setTimeout(() => setToast(null), 1600);
              return;
            }
            shareLink(refLink);
          }}
          disabled={!refLink}
        >
          Поделиться ссылкой (+500)
        </button>

        <div style={{ height: 8 }} />

        <button
          className="btn btnGhost"
          style={{ width: "100%", borderRadius: 999 }}
          disabled={!refLink}
          onClick={() => refLink && copy(refLink)}
        >
          Скопировать ссылку
        </button>

        {toast ? <div className="small" style={{ marginTop: 10 }}><b>{toast}</b></div> : null}
      </div>

      <div style={{ height: 12 }} />

      {/* Офферы */}
      <div className="card">
        <div className="title" style={{ fontSize: 16 }}>Каналы рекламодателей</div>
        <div className="small" style={{ marginTop: 6 }}>
          Подпишись на канал и забери бонус.
        </div>
      </div>

      <div style={{ height: 12 }} />

      {loading ? (
        <div className="card"><div className="small">Загружаю…</div></div>
      ) : err ? (
        <div className="card"><div className="small"><b>Ошибка:</b> {err}</div></div>
      ) : offers.length === 0 ? (
        <div className="card"><div className="small">Пока нет активных предложений.</div></div>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {offers.map((o) => {
            const claimed = !!o.claimed;
            return (
              <div key={o.id} className="card" style={{ padding: 14 }}>
                <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                  <div style={{ minWidth: 0 }}>
                    <div className="title" style={{ fontSize: 16, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {o.title}
                    </div>
                    <div className="small" style={{ marginTop: 4, opacity: 0.85, wordBreak: "break-word" }}>
                      {o.url}
                    </div>
                    <div className="small" style={{ marginTop: 8 }}>
                      Бонус: <b>+{o.reward}</b> валюты
                    </div>
                  </div>

                  <div style={{ display: "grid", gap: 8 }}>
                    <button
                      className="btn btnGhost"
                      style={{ borderRadius: 999, padding: "10px 12px", whiteSpace: "nowrap" }}
                      onClick={() => openTgLink(o.url)}
                    >
                      Открыть
                    </button>

                    <button
                      className="btn btnPrimary"
                      style={{ borderRadius: 999, padding: "10px 12px", whiteSpace: "nowrap" }}
                      disabled={needTg || claimed || claimingId === o.id}
                      onClick={() => claimOffer(o.id)}
                      title={needTg ? "Открой через Telegram, чтобы забрать бонус" : ""}
                    >
                      {claimed ? "Получено" : claimingId === o.id ? "Проверяю…" : `Забрать +${o.reward}`}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div style={{ height: 6 }} />
    </AppShell>
  );
}
