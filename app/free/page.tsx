"use client";

import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { RitualHeader } from "@/components/RitualHeader";

type Offer = { id: string; title: string; url: string; reward: number };

function normalizeTgUrl(url: string) {
  const u = String(url || "").trim();
  if (!u) return "";
  if (u.startsWith("http://") || u.startsWith("https://")) return u;
  if (u.startsWith("@")) return `https://t.me/${u.slice(1)}`;
  return `https://t.me/${u}`;
}

function openTgLink(url: string) {
  const tg = (globalThis as any)?.Telegram?.WebApp;
  const link = normalizeTgUrl(url);
  if (!link) return;
  if (tg?.openTelegramLink) tg.openTelegramLink(link);
  else window.open(link, "_blank");
}

function shareText(text: string, url: string) {
  const tg = (globalThis as any)?.Telegram?.WebApp;
  const shareUrl =
    "https://t.me/share/url?url=" +
    encodeURIComponent(url) +
    "&text=" +
    encodeURIComponent(text);

  if (tg?.openTelegramLink) tg.openTelegramLink(shareUrl);
  else window.open(shareUrl, "_blank");
}

async function fetchOffers(): Promise<Offer[]> {
  const r = await fetch("/api/free", { cache: "no-store", credentials: "include" });
  const d = await r.json().catch(() => ({}));
  return Array.isArray(d?.offers) ? d.offers : [];
}

export default function FreePage() {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);

  const referralLink = useMemo(() => {
    // Если у тебя уже работает start_param ref_... — просто открываем миниапп через share ссылку на бота/miniapp.
    // Самый универсальный вариант: делаем share текста, а URL — это бот (у тебя он есть).
    // Если позже добавишь deep-link до миниаппа, подставишь его сюда.
    const bot = "https://t.me/tarotday1_bot"; // можешь заменить на env/константу
    return bot;
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const list = await fetchOffers();
        setOffers(list);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function claim(offerId: string) {
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

      if (!r.ok) {
        setMsg(r.status === 401 ? "Нет сессии. Открой мини-приложение через Telegram." : "Не получилось. Попробуй ещё раз.");
        return;
      }

      if (d?.granted) {
        setMsg(`Готово! +${d.reward} валюты ✨`);
        window.dispatchEvent(new Event("balance:refresh"));
      } else {
        setMsg("Награда уже получена за этот канал.");
      }
    } catch {
      setMsg("Ошибка сети. Попробуй ещё раз.");
    }
  }

  return (
    <AppShell>
      <RitualHeader label="Бесплатно" />

      <div className="card">
        <div className="title" style={{ fontSize: 16 }}>Пригласи друга</div>
        <div className="small" style={{ marginTop: 6 }}>
          Поделись ссылкой — если друг впервые зайдёт в приложение, тебе начислим награду.
        </div>

        <div style={{ height: 12 }} />
        <button
          className="btn btnPrimary"
          style={{ width: "100%", borderRadius: 999 }}
          onClick={() => shareText("✨ Залетай в «Карта Дня | Daily Tarot» — карта дня, колесо и расклады!", referralLink)}
        >
          Поделиться ссылкой
        </button>
      </div>

      <div style={{ height: 12 }} />

      <div className="card">
        <div className="title" style={{ fontSize: 16 }}>Каналы</div>
        <div className="small" style={{ marginTop: 6 }}>
          Открой канал и затем нажми «Получить награду».
        </div>
      </div>

      <div style={{ height: 12 }} />

      {msg ? (
        <div className="card">
          <div className="small">{msg}</div>
        </div>
      ) : null}

      <div style={{ height: msg ? 12 : 0 }} />

      {loading ? (
        <div className="card"><div className="small">Загружаю…</div></div>
      ) : offers.length === 0 ? (
        <div className="card"><div className="small">Пока нет предложений.</div></div>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {offers.map((o) => (
            <div key={o.id} className="card" style={{ padding: 14 }}>
              <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                <div style={{ minWidth: 0 }}>
                  <div className="title" style={{ fontSize: 16, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {o.title}
                  </div>
                  <div className="small" style={{ marginTop: 6 }}>
                    Награда: <b>{o.reward}</b> валюты
                  </div>
                </div>

                <button className="btn btnGhost" style={{ borderRadius: 999, whiteSpace: "nowrap" }} onClick={() => openTgLink(o.url)}>
                  Открыть
                </button>
              </div>

              <div style={{ height: 10 }} />
              <button className="btn btnPrimary" style={{ width: "100%", borderRadius: 999 }} onClick={() => claim(o.id)}>
                Получить награду
              </button>
            </div>
          ))}
        </div>
      )}
    </AppShell>
  );
}
