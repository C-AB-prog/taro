"use client";

import React, { useEffect, useMemo, useState } from "react";

type Offer = {
  id: string;
  title: string;
  url: string;
  reward: number;
  active?: boolean;
  // если твой /api/free/offers уже возвращает:
  claimed?: boolean;
};

function openTgLink(url: string) {
  const u = String(url || "").trim();
  if (!u) return;

  const tg = (globalThis as any)?.Telegram?.WebApp;

  // Лучшие варианты внутри Telegram
  try {
    if (tg?.openTelegramLink && u.includes("t.me/")) {
      tg.openTelegramLink(u);
      return;
    }
    if (tg?.openLink) {
      tg.openLink(u, { try_instant_view: false });
      return;
    }
  } catch {}

  // запасной вариант
  try {
    window.open(u, "_blank", "noopener,noreferrer");
  } catch {}
}

export default function FreePage() {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);

  // какие офферы пользователь уже нажал "Открыть" в этой сессии
  const [opened, setOpened] = useState<Record<string, boolean>>({});

  // какие офферы уже забраны (локально)
  const [claimedLocal, setClaimedLocal] = useState<Record<string, boolean>>({});

  const [busyOpen, setBusyOpen] = useState<string | null>(null);
  const [busyClaim, setBusyClaim] = useState<string | null>(null);

  const [msg, setMsg] = useState<string>("");

  const sortedOffers = useMemo(() => {
    // сначала не забранные, потом забранные
    const arr = [...offers];
    arr.sort((a, b) => {
      const ac = !!(a.claimed || claimedLocal[a.id]);
      const bc = !!(b.claimed || claimedLocal[b.id]);
      if (ac === bc) return 0;
      return ac ? 1 : -1;
    });
    return arr;
  }, [offers, claimedLocal]);

  async function loadOffers() {
    setLoading(true);
    setMsg("");

    try {
      const r = await fetch("/api/free/offers", {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      });

      const d = await r.json().catch(() => ({}));
      const list: Offer[] = Array.isArray(d?.offers) ? d.offers : Array.isArray(d) ? d : [];

      setOffers(list);

      // если backend уже отдаёт claimed — синхронизируем локально
      const m: Record<string, boolean> = {};
      for (const o of list) {
        if (o?.id && o?.claimed) m[o.id] = true;
      }
      setClaimedLocal((prev) => ({ ...m, ...prev }));
    } catch {
      setMsg("Не удалось загрузить задания. Проверь интернет и попробуй ещё раз.");
    } finally {
      setLoading(false);
    }
  }

  async function openOffer(offerId: string, url: string) {
    if (busyOpen) return;
    setBusyOpen(offerId);
    setMsg("");

    try {
      // ✅ фиксируем факт "Открыть"
      await fetch("/api/free/open", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        cache: "no-store",
        body: JSON.stringify({ offerId }),
      }).catch(() => null);

      // включаем "Забрать"
      setOpened((p) => ({ ...p, [offerId]: true }));

      // и открываем ссылку
      openTgLink(url);
    } finally {
      setBusyOpen(null);
    }
  }

  async function claimOffer(offerId: string) {
    if (busyClaim) return;
    setBusyClaim(offerId);
    setMsg("");

    try {
      const r = await fetch("/api/free/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        cache: "no-store",
        body: JSON.stringify({ offerId }),
      });

      const d = await r.json().catch(() => ({}));

      if (d?.ok) {
        setClaimedLocal((p) => ({ ...p, [offerId]: true }));
        window.dispatchEvent(new Event("balance:refresh"));
        setMsg(`✅ Начислено +${Number(d.reward || 0)}!`);
      } else {
        const e = String(d?.error || "UNKNOWN");

        if (e === "OPEN_REQUIRED") setMsg("Сначала нажми «Открыть», потом можно «Забрать».");
        else if (e === "ALREADY") setMsg("Ты уже забрал награду за это задание.");
        else if (e === "NOT_FOUND") setMsg("Задание не найдено или отключено.");
        else setMsg("Не получилось забрать награду. Попробуй ещё раз.");
      }
    } catch {
      setMsg("Ошибка сети. Попробуй ещё раз.");
    } finally {
      setBusyClaim(null);
    }
  }

  useEffect(() => {
    loadOffers();
  }, []);

  return (
    <div style={{ paddingBottom: 90 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <h2 style={{ margin: 0 }}>Бесплатно</h2>
        <button
          className="btn btnGhost"
          style={{ borderRadius: 999, padding: "10px 14px" }}
          onClick={loadOffers}
          disabled={loading}
        >
          Обновить
        </button>
      </div>

      <div className="small" style={{ marginTop: 8 }}>
        Нажми <b>«Открыть»</b> → потом станет доступно <b>«Забрать»</b>.
      </div>

      {msg ? (
        <div style={{ marginTop: 12 }}>
          <div className="small">{msg}</div>
        </div>
      ) : null}

      {loading ? (
        <div style={{ marginTop: 16 }} className="small">
          Загрузка…
        </div>
      ) : null}

      {!loading && sortedOffers.length === 0 ? (
        <div style={{ marginTop: 16 }} className="small">
          Пока нет доступных заданий.
        </div>
      ) : null}

      <div style={{ marginTop: 14, display: "grid", gap: 12 }}>
        {sortedOffers.map((o) => {
          const alreadyClaimed = !!(o.claimed || claimedLocal[o.id]);
          const canClaim = !!opened[o.id] && !alreadyClaimed;

          return (
            <div
              key={o.id}
              style={{
                padding: 14,
                borderRadius: 16,
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700, lineHeight: 1.2 }}>{o.title}</div>
                  <div className="small" style={{ marginTop: 6, opacity: 0.9 }}>
                    Награда: <b>+{o.reward}</b>
                  </div>
                </div>

                {alreadyClaimed ? (
                  <div className="small" style={{ opacity: 0.85 }}>
                    ✅ Забрано
                  </div>
                ) : null}
              </div>

              <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
                <button
                  className="btn btnPrimary"
                  style={{ borderRadius: 999, padding: "10px 14px" }}
                  onClick={() => openOffer(o.id, o.url)}
                  disabled={busyOpen !== null || alreadyClaimed}
                >
                  {busyOpen === o.id ? "Открываю…" : "Открыть"}
                </button>

                <button
                  className="btn btnGhost"
                  style={{ borderRadius: 999, padding: "10px 14px" }}
                  onClick={() => claimOffer(o.id)}
                  disabled={!canClaim || busyClaim !== null}
                  title={!opened[o.id] ? "Сначала нажми «Открыть»" : ""}
                >
                  {busyClaim === o.id ? "Проверяю…" : "Забрать"}
                </button>
              </div>

              {!alreadyClaimed && !opened[o.id] ? (
                <div className="small" style={{ marginTop: 10, opacity: 0.8 }}>
                  Сначала нажми <b>«Открыть»</b>, чтобы активировать <b>«Забрать»</b>.
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
