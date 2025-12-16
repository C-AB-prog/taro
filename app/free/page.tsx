"use client";

import React, { useEffect, useMemo, useState } from "react";

type Offer = {
  id: string;
  title: string;
  url: string;
  reward: number;
  claimed: boolean;
};

function openTgLink(url: string) {
  const u = String(url || "").trim();
  if (!u) return;

  const tg = (globalThis as any)?.Telegram?.WebApp;

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

  try {
    window.open(u, "_blank", "noopener,noreferrer");
  } catch {}
}

function Chip({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "good" | "warn";
}) {
  const style: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "6px 10px",
    borderRadius: 999,
    fontSize: 12,
    lineHeight: 1,
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.06)",
    opacity: 0.95,
    userSelect: "none",
  };

  if (tone === "good") {
    style.border = "1px solid rgba(255,255,255,0.14)";
    style.background = "rgba(255,255,255,0.10)";
  }
  if (tone === "warn") {
    style.border = "1px solid rgba(255,255,255,0.14)";
    style.background = "rgba(255,255,255,0.08)";
  }

  return <span style={style}>{children}</span>;
}

export default function FreePage() {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);

  // пользователь нажал "Открыть" (в текущей сессии страницы)
  const [opened, setOpened] = useState<Record<string, boolean>>({});

  // локально помечаем "забрано" (поверх API)
  const [claimedLocal, setClaimedLocal] = useState<Record<string, boolean>>({});

  const [busyOpen, setBusyOpen] = useState<string | null>(null);
  const [busyClaim, setBusyClaim] = useState<string | null>(null);

  const [toast, setToast] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const sortedOffers = useMemo(() => {
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
    setToast(null);

    try {
      const r = await fetch("/api/free/offers", {
        method: "GET",
        credentials: "include",
        cache: "no-store",
      });

      const d = await r.json().catch(() => ({}));
      const list: Offer[] = Array.isArray(d?.offers) ? d.offers : [];

      setOffers(list);

      // синхронизируем claimed в локальное состояние (на всякий)
      const m: Record<string, boolean> = {};
      for (const o of list) {
        if (o?.id && o?.claimed) m[o.id] = true;
      }
      setClaimedLocal((prev) => ({ ...prev, ...m }));
    } catch {
      setToast({ type: "err", text: "Не удалось загрузить задания. Проверь интернет и попробуй ещё раз." });
    } finally {
      setLoading(false);
    }
  }

  async function openOffer(offerId: string, url: string) {
    if (busyOpen) return;
    setBusyOpen(offerId);
    setToast(null);

    try {
      await fetch("/api/free/open", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        cache: "no-store",
        body: JSON.stringify({ offerId }),
      }).catch(() => null);

      setOpened((p) => ({ ...p, [offerId]: true }));
      openTgLink(url);
    } finally {
      setBusyOpen(null);
    }
  }

  async function claimOffer(offerId: string) {
    if (busyClaim) return;
    setBusyClaim(offerId);
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

      if (d?.ok) {
        setClaimedLocal((p) => ({ ...p, [offerId]: true }));
        window.dispatchEvent(new Event("balance:refresh"));
        setToast({ type: "ok", text: `Начислено +${Number(d.reward || 0)} ✨` });
      } else {
        const e = String(d?.error || "UNKNOWN");
        if (e === "OPEN_REQUIRED") setToast({ type: "err", text: "Сначала нажми «Открыть», потом можно «Забрать»." });
        else if (e === "ALREADY") setToast({ type: "err", text: "Ты уже забрал награду за это задание." });
        else if (e === "NOT_FOUND") setToast({ type: "err", text: "Задание не найдено или отключено." });
        else setToast({ type: "err", text: "Не получилось забрать награду. Попробуй ещё раз." });
      }
    } catch {
      setToast({ type: "err", text: "Ошибка сети. Попробуй ещё раз." });
    } finally {
      setBusyClaim(null);
    }
  }

  useEffect(() => {
    loadOffers();
  }, []);

  return (
    <div style={{ paddingBottom: 100 }}>
      {/* Header */}
      <div
        style={{
          borderRadius: 18,
          padding: 16,
          border: "1px solid rgba(255,255,255,0.10)",
          background:
            "radial-gradient(1200px 400px at 10% -20%, rgba(255,255,255,0.10), transparent 60%), rgba(255,255,255,0.03)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div>
            <div style={{ fontSize: 20, fontWeight: 800, lineHeight: 1.1 }}>Бесплатно</div>
            <div className="small" style={{ marginTop: 6, opacity: 0.9 }}>
              Нажми <b>«Открыть»</b> → затем станет доступно <b>«Забрать»</b>.
            </div>
          </div>

          <button
            className="btn btnGhost"
            style={{ borderRadius: 999, padding: "10px 14px", whiteSpace: "nowrap" }}
            onClick={loadOffers}
            disabled={loading}
          >
            {loading ? "…" : "Обновить"}
          </button>
        </div>

        {/* Toast */}
        {toast ? (
          <div
            style={{
              marginTop: 12,
              padding: "10px 12px",
              borderRadius: 14,
              border: "1px solid rgba(255,255,255,0.10)",
              background: toast.type === "ok" ? "rgba(255,255,255,0.10)" : "rgba(255,255,255,0.06)",
            }}
            className="small"
          >
            {toast.type === "ok" ? "✅ " : "⚠️ "}
            {toast.text}
          </div>
        ) : null}
      </div>

      {/* List */}
      <div style={{ marginTop: 14, display: "grid", gap: 12 }}>
        {loading ? (
          <div className="small" style={{ marginTop: 4, opacity: 0.9 }}>
            Загрузка…
          </div>
        ) : null}

        {!loading && sortedOffers.length === 0 ? (
          <div className="small" style={{ marginTop: 4, opacity: 0.9 }}>
            Пока нет доступных заданий.
          </div>
        ) : null}

        {sortedOffers.map((o) => {
          const alreadyClaimed = !!(o.claimed || claimedLocal[o.id]);
          const canClaim = !!opened[o.id] && !alreadyClaimed;

          return (
            <div
              key={o.id}
              style={{
                borderRadius: 18,
                padding: 14,
                border: "1px solid rgba(255,255,255,0.10)",
                background: "rgba(255,255,255,0.03)",
              }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 800, fontSize: 16, lineHeight: 1.15 }}>{o.title}</div>

                  <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 8 }}>
                    <Chip>
                      🎁 +<b>{o.reward}</b>
                    </Chip>

                    {alreadyClaimed ? (
                      <Chip tone="good">✅ Забрано</Chip>
                    ) : opened[o.id] ? (
                      <Chip tone="good">🟢 Можно забрать</Chip>
                    ) : (
                      <Chip tone="warn">🔒 Сначала «Открыть»</Chip>
                    )}
                  </div>
                </div>
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
                  style={{ borderRadius: 999, padding: "10px 14px", opacity: canClaim ? 1 : 0.75 }}
                  onClick={() => claimOffer(o.id)}
                  disabled={!canClaim || busyClaim !== null}
                  title={!opened[o.id] ? "Сначала нажми «Открыть»" : ""}
                >
                  {busyClaim === o.id ? "Проверяю…" : "Забрать"}
                </button>
              </div>

              {!alreadyClaimed && !opened[o.id] ? (
                <div className="small" style={{ marginTop: 10, opacity: 0.85 }}>
                  Нажми <b>«Открыть»</b> — это разблокирует <b>«Забрать»</b>.
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
