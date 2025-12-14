"use client";

import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { RitualHeader } from "@/components/RitualHeader";

type Me = { ok: true; user: { id: string; balance: number } } | { ok: false };

export default function FreePage() {
  const [me, setMe] = useState<Me | null>(null);
  const [copied, setCopied] = useState(false);

  const bot = (process.env.NEXT_PUBLIC_BOT_USERNAME || "").trim();

  useEffect(() => {
    (async () => {
      const r = await fetch("/api/me", { cache: "no-store", credentials: "include" }).catch(() => null);
      const d = r ? await r.json().catch(() => null) : null;
      setMe(d);
    })();
  }, []);

  const link = useMemo(() => {
    if (!bot) return "";
    const uid = (me as any)?.user?.id;
    if (!uid) return "";
    return `https://t.me/${bot}?startapp=ref_${uid}`;
  }, [bot, me]);

  async function copy() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {}
  }

  function share() {
    if (!link) return;
    const tg = (globalThis as any)?.Telegram?.WebApp;
    const text = "Зайди в «Карта Дня | Daily Tarot» — тебе будет интересно ✨";
    const url = `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(text)}`;
    if (tg?.openTelegramLink) tg.openTelegramLink(url);
    else window.open(url, "_blank");
  }

  return (
    <AppShell>
      <RitualHeader label="Бесплатно" />

      <div className="card">
        <div className="title">Пригласи друга</div>
        <div className="small" style={{ marginTop: 6 }}>
          За 1 нового друга: <b>+500 валюты</b>
        </div>

        <div style={{ height: 10 }} />

        {!bot ? (
          <div className="small"><b>Нужно:</b> добавить env <code>NEXT_PUBLIC_BOT_USERNAME</code>.</div>
        ) : !link ? (
          <div className="small">Готовлю ссылку…</div>
        ) : (
          <>
            <div className="card" style={{ padding: 12, background: "rgba(255,255,255,.70)" }}>
              <div className="small" style={{ wordBreak: "break-all" }}>{link}</div>
            </div>

            <div style={{ height: 10 }} />

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <button className="btn btnPrimary" style={{ borderRadius: 999 }} onClick={share}>
                Поделиться
              </button>
              <button className="btn btnGhost" style={{ borderRadius: 999 }} onClick={copy}>
                {copied ? "Скопировано ✓" : "Копировать"}
              </button>
            </div>
          </>
        )}
      </div>

      <div style={{ height: 12 }} />

      <div className="card">
        <div className="title">Каналы рекламодателей</div>
        <div className="small" style={{ marginTop: 6 }}>
          Подпишись и забери бонус.
        </div>

        <div style={{ height: 10 }} />

        <div className="card" style={{ padding: 12, background: "rgba(255,255,255,.70)" }}>
          <div className="small">Пока нет доступных каналов. Загляни чуть позже ✨</div>
        </div>
      </div>
    </AppShell>
  );
}
