"use client";

import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";

const BOT_USERNAME = "tarotday1_bot"; // ← если у тебя другой бот — поменяй здесь (без @)

type Ad = { title: string; url: string; username?: string | null };

function extractUsernameFromTmeUrl(url: string): string | null {
  try {
    const u = new URL(url);
    if (!/t\.me$/i.test(u.hostname) && !/telegram\.me$/i.test(u.hostname)) return null;
    const p = u.pathname.replace(/^\/+/, "");
    if (!p) return null;
    // если invite link вида /+xxxx — не годится для аватарки
    if (p.startsWith("+")) return null;
    // /c/.. тоже не надо
    if (p.startsWith("c/")) return null;
    return p.split("/")[0] || null;
  } catch {
    return null;
  }
}

function userpicByUsername(username: string) {
  return `https://t.me/i/userpic/320/${encodeURIComponent(username)}.jpg`;
}

export default function FreePage() {
  const [myId, setMyId] = useState<string | null>(null);
  const [ads, setAds] = useState<Ad[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const me = await fetch("/api/me", { credentials: "include", cache: "no-store" })
          .then((r) => r.json())
          .catch(() => null);

        const id = String(me?.user?.id || me?.me?.id || "");
        if (id) setMyId(id);

        const res = await fetch("/api/free/ads", { credentials: "include", cache: "no-store" })
          .then((r) => r.json())
          .catch(() => null);

        if (res?.ok && Array.isArray(res.items)) setAds(res.items);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const inviteLink = useMemo(() => {
    if (!myId) return null;
    return `https://t.me/${BOT_USERNAME}?startapp=ref_${myId}`;
  }, [myId]);

  function openTgLink(url: string) {
    const tg = (globalThis as any)?.Telegram?.WebApp;
    try {
      tg?.openTelegramLink?.(url);
    } catch {
      window.open(url, "_blank");
    }
  }

  function shareInvite() {
    if (!inviteLink) return;

    const text =
      "✨ Забери «Карта Дня | Daily Tarot»\n" +
      "Карта дня, колесо фортуны и расклады — мягко и мистически.\n\n" +
      "Открывай по ссылке:";

    openTgLink(`https://t.me/share/url?url=${encodeURIComponent(inviteLink)}&text=${encodeURIComponent(text)}`);
  }

  return (
    <AppShell>
      <h1 className="h1">Бесплатно</h1>

      <div className="card">
        <div className="title" style={{ fontSize: 16 }}>Пригласить друга</div>
        <div className="small" style={{ marginTop: 6 }}>
          За каждого <b>нового</b> друга, который впервые зайдёт по твоей ссылке — тебе начислится <b>+500</b> валюты.
        </div>

        <div style={{ height: 12 }} />

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
        <div className="small" style={{ marginTop: 6 }}>Подпишись — поддержи проект 💛</div>
      </div>

      <div style={{ height: 10 }} />

      {loading ? (
        <div className="card"><div className="small">Загрузка…</div></div>
      ) : ads.length === 0 ? (
        <div className="card"><div className="small">Пока нет партнёров.</div></div>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          {ads.map((a, idx) => {
            const username = a.username || extractUsernameFromTmeUrl(a.url);
            return (
              <button
                key={`${a.url}-${idx}`}
                className="pressable"
                type="button"
                onClick={() => openTgLink(a.url)}
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
                  {username ? (
                    <img
                      src={userpicByUsername(username)}
                      alt={a.title}
                      width={52}
                      height={52}
                      style={{
                        width: 52,
                        height: 52,
                        borderRadius: 16,
                        objectFit: "cover",
                        border: "1px solid rgba(20,16,10,.10)",
                        background: "rgba(255,255,255,.60)",
                      }}
                    />
                  ) : (
                    <div
                      aria-hidden="true"
                      style={{
                        width: 52,
                        height: 52,
                        borderRadius: 16,
                        border: "1px solid rgba(20,16,10,.10)",
                        background: "rgba(245,232,196,.55)",
                        display: "grid",
                        placeItems: "center",
                        fontWeight: 900,
                        color: "rgba(23,18,12,.75)",
                      }}
                    >
                      TG
                    </div>
                  )}

                  <div className="col">
                    <div className="title" style={{ fontSize: 15 }}>{a.title}</div>
                    <div className="small" style={{ marginTop: 4 }}>Подпишись</div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      <div style={{ height: 6 }} />
    </AppShell>
  );
}
