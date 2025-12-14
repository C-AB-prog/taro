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

async function fetchMeId(): Promise<string | null> {
  try {
    const r = await fetch("/api/me", { cache: "no-store", credentials: "include" });
    if (!r.ok) return null;
    const d = await r.json().catch(() => ({}));
    const id = d?.user?.id ?? d?.id ?? null;
    return typeof id === "string" ? id : null;
  } catch {
    return null;
  }
}

async function fetchOffers(): Promise<Offer[]> {
  try {
    const r = await fetch("/api/free/offers", { cache: "no-store", credentials: "include" });
    const d = await r.json().catch(() => ({}));
    return Array.isArray(d?.offers) ? d.offers : [];
  } catch {
    return [];
  }
}

export default function FreePage() {
  const [meId, setMeId] = useState<string | null>(null);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setMeId(await fetchMeId());
      setOffers(await fetchOffers());
    })();
  }, []);

  const referral = useMemo(() => {
    if (!meId) return { code: "", link: "" };
    const code = `ref_${meId}`;

    const bot = process.env.NEXT_PUBLIC_BOT_USERNAME || "";
    const shortName = process.env.NEXT_PUBLIC_MINIAPP_SHORTNAME || "";

    // https, без "@"
    const link =
      bot && shortName
        ? `https://t.me/${bot}/${shortName}?startapp=${encodeURIComponent(code)}`
        : bot
        ? `https://t.me/${bot}?startapp=${encodeURIComponent(code)}`
        : "";

    return { code, link };
  }, [meId]);

  function openTgLink(url: string) {
    const tg = (globalThis as any)?.Telegram?.WebApp;
    if (tg?.openTelegramLink) tg.openTelegramLink(url);
    else window.open(url, "_blank");
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setMsg("Скопировано ✨");
      (globalThis as any)?.Telegram?.WebApp?.HapticFeedback?.notificationOccurred?.("success");
      setTimeout(() => setMsg(null), 1200);
    } catch {
      setMsg("Не удалось скопировать");
      setTimeout(() => setMsg(null), 1200);
    }
  }

  function share(link: string) {
    const text =
      "✨ Забери 500 валюты за приглашение друга в «Карта Дня | Daily Tarot» — открой и попробуй!";
    const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text)}`;
    openTgLink(shareUrl);
  }

  async function claimOffer(offerId: string) {
    setMsg(null);
    try {
      const r = await fetch("/api/free/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        cache: "no-store",
        body: JSON.stringify({ offerId }),
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok && d?.ok && d?.granted) {
        window.dispatchEvent(new Event("balance:refresh"));
        setMsg(`Готово! +${d.reward} валюты ✨`);
      } else {
        setMsg(d?.error === "ALREADY" ? "Уже получено ✅" : "Не получилось, попробуй ещё раз");
      }
      setTimeout(() => setMsg(null), 1400);
    } catch {
      setMsg("Ошибка сети");
      setTimeout(() => setMsg(null), 1400);
    }
  }

  return (
    <AppShell>
      <RitualHeader label="Бесплатно" />

      <div className="card">
        <div className="title" style={{ fontSize: 16 }}>Пригласи друга</div>
        <div className="small" style={{ marginTop: 6 }}>
          За 1 нового друга: <b>+500 валюты</b>
        </div>

        <div style={{ height: 12 }} />

        {!referral.link ? (
          <div className="small">
            Чтобы ссылка работала, добавь в Vercel env:
            <br />
            <b>NEXT_PUBLIC_BOT_USERNAME</b> (без @) и <b>NEXT_PUBLIC_MINIAPP_SHORTNAME</b>
          </div>
        ) : (
          <>
            <div className="small" style={{ wordBreak: "break-all" }}>
              {referral.link}
            </div>

            <div style={{ height: 10 }} />

            <div className="segRow" style={{ gap: 8 }}>
              <button className="btn btnPrimary" style={{ borderRadius: 999 }} onClick={() => copy(referral.link)}>
                Скопировать ссылку
              </button>
              <button className="btn btnGhost" style={{ borderRadius: 999 }} onClick={() => share(referral.link)}>
                Поделиться
              </button>
            </div>
          </>
        )}

        {msg ? <div className="small" style={{ marginTop: 10 }}><b>{msg}</b></div> : null}
      </div>

      <div style={{ height: 12 }} />

      <div className="card">
        <div className="title" style={{ fontSize: 16 }}>Каналы рекламодателей</div>
        <div className="small" style={{ marginTop: 6 }}>
          Подпишись и забери бонус. (Пока без проверки подписки.)
        </div>
      </div>

      <div style={{ height: 12 }} />

      <div style={{ display: "grid", gap: 10 }}>
        {offers.length === 0 ? (
          <div className="card">
            <div className="small">Пока нет доступных каналов. Загляни чуть позже ✨</div>
          </div>
        ) : (
          offers.map((o) => (
            <div key={o.id} className="card" style={{ padding: 14 }}>
              <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ minWidth: 0 }}>
                  <div className="title" style={{ fontSize: 16, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {o.title}
                  </div>
                  <div className="small" style={{ marginTop: 4 }}>Подпишись • +{o.reward} валюты</div>
                </div>

                <div style={{ display: "grid", gap: 8, justifyItems: "end" }}>
                  <button className="btn btnGhost" style={{ borderRadius: 999 }} onClick={() => openTgLink(o.url)}>
                    Открыть
                  </button>
                  <button className="btn btnPrimary" style={{ borderRadius: 999 }} onClick={() => claimOffer(o.id)}>
                    Получить
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </AppShell>
  );
}
