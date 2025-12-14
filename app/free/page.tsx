"use client";

import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { RitualHeader } from "@/components/RitualHeader";

type Offer = {
  id: string;
  title: string;
  url: string;
  reward: number;
};

type MeResp =
  | { ok: true; user: { id: string; balance: number } }
  | { ok: true; balance: number; user?: { id?: string } }
  | { ok: false; error?: string };

function safeUrl(u: string) {
  const s = String(u || "").trim();
  if (!s) return "";
  if (s.startsWith("http://") || s.startsWith("https://")) return s;
  // если вдруг пришло t.me/...
  if (s.startsWith("t.me/")) return `https://${s}`;
  // если вдруг пришло @name
  if (s.startsWith("@")) return `https://t.me/${s.slice(1)}`;
  return s;
}

function openTgLink(url: string) {
  const u = safeUrl(url);
  if (!u) return;
  const tg = (globalThis as any)?.Telegram?.WebApp;
  try {
    if (tg?.openTelegramLink) return tg.openTelegramLink(u);
  } catch {}
  window.open(u, "_blank", "noopener,noreferrer");
}

async function fetchOffers(): Promise<Offer[]> {
  const r = await fetch("/api/free/offers", { cache: "no-store", credentials: "include" });
  if (!r.ok) return [];
  const d = await r.json().catch(() => ({}));
  const arr = d?.offers ?? d?.items ?? [];
  if (!Array.isArray(arr)) return [];
  return arr
    .map((x: any) => ({
      id: String(x?.id || ""),
      title: String(x?.title || x?.name || ""),
      url: String(x?.url || ""),
      reward: Number(x?.reward || 0),
    }))
    .filter((x: Offer) => x.id && x.title && x.url);
}

async function fetchMe(): Promise<{ id: string | null }> {
  try {
    const r = await fetch("/api/me", { cache: "no-store", credentials: "include" });
    const d: MeResp = await r.json().catch(() => ({ ok: false }));
    const id = (d as any)?.user?.id ?? (d as any)?.me?.id ?? null;
    return { id: typeof id === "string" && id.length > 0 ? id : null };
  } catch {
    return { id: null };
  }
}

async function claimOffer(offerId: string) {
  const r = await fetch("/api/free/claim", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    cache: "no-store",
    body: JSON.stringify({ offerId }),
  });
  const d = await r.json().catch(() => ({}));
  return { ok: !!d?.ok, error: String(d?.error || "") };
}

function initials(title: string) {
  const t = String(title || "").trim();
  if (!t) return "•";
  const parts = t.split(/\s+/).filter(Boolean);
  const a = parts[0]?.[0] || "";
  const b = parts[1]?.[0] || "";
  return (a + b).toUpperCase() || t.slice(0, 1).toUpperCase();
}

export default function FreePage() {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);

  const [myId, setMyId] = useState<string | null>(null);

  // ⚠️ если env не задан — используем твой текущий бот как fallback
  const BOT_USERNAME = (process.env.NEXT_PUBLIC_BOT_USERNAME || "tarotday1_bot").replace(/^@/, "");
  const MINIAPP_SHORTNAME = (process.env.NEXT_PUBLIC_MINIAPP_SHORTNAME || "").trim();

  const inviteLink = useMemo(() => {
    if (!myId) return "";
    const payload = `ref_${myId}`;

    // предпочтительный формат
    if (MINIAPP_SHORTNAME) {
      return `https://t.me/${BOT_USERNAME}/${MINIAPP_SHORTNAME}?startapp=${encodeURIComponent(payload)}`;
    }

    // fallback (часто тоже работает)
    return `https://t.me/${BOT_USERNAME}?startapp=${encodeURIComponent(payload)}`;
  }, [BOT_USERNAME, MINIAPP_SHORTNAME, myId]);

  useEffect(() => {
    let alive = true;

    (async () => {
      setLoading(true);
      const [o, me] = await Promise.all([fetchOffers(), fetchMe()]);
      if (!alive) return;
      setOffers(o);
      setMyId(me.id);
      setLoading(false);
    })();

    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(t);
  }, [toast]);

  async function copyInvite() {
    if (!inviteLink) {
      setToast("Ссылка пока недоступна.");
      return;
    }
    try {
      await navigator.clipboard.writeText(inviteLink);
      setToast("Ссылка скопирована ✨");
      (globalThis as any)?.Telegram?.WebApp?.HapticFeedback?.notificationOccurred?.("success");
    } catch {
      setToast(inviteLink);
    }
  }

  function shareInvite() {
    if (!inviteLink) {
      setToast("Ссылка пока недоступна.");
      return;
    }
    const text = "Залетай в «Карта Дня | Daily Tarot» — тебе понравится ✨";
    const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(inviteLink)}&text=${encodeURIComponent(text)}`;
    openTgLink(shareUrl);
  }

  async function onClaim(offerId: string) {
    const res = await claimOffer(offerId);
    if (res.ok) {
      setToast("Бонус начислен ✨");
      window.dispatchEvent(new Event("balance:refresh"));
      (globalThis as any)?.Telegram?.WebApp?.HapticFeedback?.notificationOccurred?.("success");
    } else {
      // частые случаи: уже забирал
      if (res.error === "ALREADY_CLAIMED") setToast("Ты уже забирал бонус за этот канал.");
      else if (res.error === "UNAUTHORIZED") setToast("Открой мини-приложение через Telegram и попробуй снова.");
      else setToast("Не получилось. Попробуй ещё раз.");
    }
  }

  return (
    <AppShell>
      <RitualHeader label="Бесплатно" />

      {toast ? (
        <div className="card" style={{ marginBottom: 12 }}>
          <div className="small">{toast}</div>
        </div>
      ) : null}

      <div className="card" style={{ padding: 14 }}>
        <div className="title" style={{ fontSize: 16 }}>
          Пригласи друга
        </div>
        <div className="small" style={{ marginTop: 6, opacity: 0.9 }}>
          За 1 нового друга: <b>+500</b> валюты
        </div>

        <div style={{ height: 12 }} />

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <button className="btn btnPrimary" style={{ borderRadius: 999 }} onClick={shareInvite} type="button">
            Пригласить
          </button>
          <button className="btn btnGhost" style={{ borderRadius: 999 }} onClick={copyInvite} type="button">
            Скопировать
          </button>
        </div>

        <div className="small" style={{ marginTop: 10, opacity: 0.78 }}>
          Друг должен открыть мини-приложение по твоей ссылке и зайти впервые.
        </div>
      </div>

      <div style={{ height: 12 }} />

      <div className="card" style={{ padding: 14 }}>
        <div className="title" style={{ fontSize: 16 }}>
          Каналы рекламодателей
        </div>
        <div className="small" style={{ marginTop: 6, opacity: 0.9 }}>
          Подпишись на канал и забери бонус.
        </div>

        <div style={{ height: 12 }} />

        {loading ? (
          <div className="small">Загружаю…</div>
        ) : offers.length === 0 ? (
          <div className="small" style={{ opacity: 0.85 }}>
            Пока нет доступных каналов. Загляни чуть позже ✨
          </div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {offers.map((o) => (
              <div
                key={o.id}
                className="card"
                style={{
                  padding: 12,
                  background: "rgba(255,255,255,.78)",
                }}
              >
                <div className="row" style={{ alignItems: "center" }}>
                  {/* “аватарка” без токена — делаем красивый бейдж */}
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 999,
                      display: "grid",
                      placeItems: "center",
                      fontWeight: 950,
                      border: "1px solid rgba(176,142,66,.30)",
                      background: "rgba(245,232,196,.55)",
                      color: "rgba(23,18,12,.88)",
                      flex: "0 0 auto",
                    }}
                    aria-hidden="true"
                  >
                    {initials(o.title)}
                  </div>

                  <div className="col">
                    <div className="title" style={{ fontSize: 15 }}>
                      {o.title}
                    </div>
                    <div className="small" style={{ marginTop: 3, opacity: 0.9 }}>
                      Бонус: <b>+{o.reward}</b> валюты
                    </div>
                  </div>
                </div>

                <div style={{ height: 10 }} />

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <button
                    className="btn btnGhost"
                    style={{ borderRadius: 999 }}
                    type="button"
                    onClick={() => openTgLink(o.url)}
                  >
                    Открыть канал
                  </button>

                  <button
                    className="btn btnPrimary"
                    style={{ borderRadius: 999 }}
                    type="button"
                    onClick={() => onClaim(o.id)}
                  >
                    Забрать бонус
                  </button>
                </div>

                <div className="small" style={{ marginTop: 8, opacity: 0.75 }}>
                  {safeUrl(o.url)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
