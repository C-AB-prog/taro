"use client";

import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";

type Ad = { username: string; title: string };

function userpic(username: string) {
  const u = username.replace(/^@/, "");
  return `https://t.me/i/userpic/320/${encodeURIComponent(u)}.jpg`;
}

export default function FreePage() {
  const bot = process.env.NEXT_PUBLIC_BOT_USERNAME || "tarotday1_bot";

  const [myId, setMyId] = useState<string | null>(null);
  const [ads, setAds] = useState<Ad[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        // нужен id чтобы собрать ссылку ref_
        const me = await fetch("/api/me", { credentials: "include", cache: "no-store" }).then((r) => r.json()).catch(() => null);
        if (me?.ok && me?.user?.id) setMyId(String(me.user.id));

        const res = await fetch("/api/free/ads", { cache: "no-store" }).then((r) => r.json()).catch(() => null);
        if (res?.ok && Array.isArray(res.items)) setAds(res.items);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const inviteLink = useMemo(() => {
    if (!myId) return null;
    // mini-app deep link: startapp
    return `https://t.me/${bot}?startapp=ref_${myId}`;
  }, [bot, myId]);

  function shareInvite() {
    if (!inviteLink) return;
    const tg = (globalThis as any)?.Telegram?.WebApp;
    const text = `✨ Забери таро и бонус в «Карта Дня | Daily Tarot»\n\nОткрывай по ссылке: ${inviteLink}`;
    const share = `https://t.me/share/url?url=${encodeURIComponent(inviteLink)}&text=${encodeURIComponent(text)}`;

    try {
      tg?.openTelegramLink?.(share);
    } catch {
      window.open(share, "_blank");
    }
  }

  function openChannel(username: string) {
    const tg = (globalThis as any)?.Telegram?.WebApp;
    const link = `https://t.me/${username.replace(/^@/, "")}`;
    try {
      tg?.openTelegramLink?.(link);
    } catch {
      window.open(link, "_blank");
    }
  }

  return (
    <AppShell>
      <h1 className="h1">Бесплатно</h1>

      <div className="card">
        <div className="title" style={{ fontSize: 16 }}>Пригласи друга</div>
        <div className="small" style={{ marginTop: 4 }}>
          За каждого нового друга, который зайдёт в приложение по твоей ссылке — <b>+500</b> валюты тебе.
        </div>

        <div style={{ height: 10 }} />

        <button className="btn btnPrimary" style={{ width: "100%", borderRadius: 999 }} onClick={shareInvite} disabled={!inviteLink}>
          {inviteLink ? "Поделиться ссылкой" : "Загружаю…"}
        </button>

        {inviteLink ? (
          <div className="small" style={{ marginTop: 10, opacity: 0.85 }}>
            Твоя ссылка: <span style={{ wordBreak: "break-all" }}>{inviteLink}</span>
          </div>
        ) : null}
      </div>

      <div style={{ height: 12 }} />

      <div className="card">
        <div className="title" style={{ fontSize: 16 }}>Каналы партнёров</div>
        <div className="small" style={{ marginTop: 4 }}>Подпишись — поддержи проект 💛</div>
      </div>

      <div style={{ height: 10 }} />

      {loading ? (
        <div className="card"><div className="small">Загрузка…</div></div>
      ) : ads.length === 0 ? (
        <div className="card"><div className="small">Пока нет партнёров.</div></div>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {ads.map((a) => (
            <button
              key={a.username}
              className="pressable"
              onClick={() => openChannel(a.username)}
              style={{
                textAlign: "left",
                border: "1px solid rgba(20,16,10,.10)",
                background: "rgba(255,255,255,.86)",
                borderRadius: 18,
                padding: 12,
                cursor: "pointer",
              }}
            >
              <div className="row" style={{ alignItems: "center" }}>
                <img
                  src={userpic(a.username)}
                  alt={a.title}
                  width={48}
                  height={48}
                  style={{ width: 48, height: 48, borderRadius: 14, objectFit: "cover", border: "1px solid rgba(20,16,10,.10)" }}
                />
                <div className="col">
                  <div className="title" style={{ fontSize: 15 }}>{a.title}</div>
                  <div className="small" style={{ marginTop: 2 }}>Подпишись</div>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      <div style={{ height: 4 }} />
    </AppShell>
  );
}
