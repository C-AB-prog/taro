"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Offer = {
  id: string;
  title: string;
  url: string;
  reward: number;
  claimed: boolean;
};

function tg() {
  return (globalThis as any)?.Telegram?.WebApp;
}

function openTgLink(url: string) {
  const u = String(url || "").trim();
  if (!u) return;

  const t = tg();
  try {
    if (t?.openTelegramLink && u.includes("t.me/")) {
      t.openTelegramLink(u);
      return;
    }
    if (t?.openLink) {
      t.openLink(u, { try_instant_view: false });
      return;
    }
  } catch {}

  window.open(u, "_blank", "noopener,noreferrer");
}

function prettyUrl(u: string) {
  return String(u || "").replace(/^https?:\/\//, "");
}

function Card({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        borderRadius: 18,
        padding: 14,
        border: "1px solid rgba(0,0,0,0.06)",
        background: "rgba(255,255,255,0.92)",
        boxShadow: "0 10px 26px rgba(0,0,0,0.06)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function Tag({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "good" | "warn";
}) {
  const base: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "6px 10px",
    borderRadius: 999,
    fontSize: 12,
    lineHeight: 1,
    border: "1px solid rgba(0,0,0,0.06)",
    background: "rgba(0,0,0,0.03)",
    userSelect: "none",
    whiteSpace: "nowrap",
  };

  if (tone === "good") {
    base.background = "rgba(46, 204, 113, 0.10)";
    base.border = "1px solid rgba(46, 204, 113, 0.25)";
  }
  if (tone === "warn") {
    base.background = "rgba(241, 196, 15, 0.14)";
    base.border = "1px solid rgba(241, 196, 15, 0.35)";
  }

  return <span style={base}>{children}</span>;
}

function IconButton({
  title,
  onClick,
  disabled,
  children,
}: {
  title: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      className="btn btnGhost"
      title={title}
      onClick={onClick}
      disabled={disabled}
      style={{
        width: 42,
        height: 42,
        borderRadius: 999,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(255,255,255,0.92)",
        border: "1px solid rgba(0,0,0,0.06)",
        boxShadow: "0 8px 18px rgba(0,0,0,0.05)",
      }}
    >
      <span style={{ fontSize: 18, lineHeight: 1 }}>{children}</span>
    </button>
  );
}

export default function FreePage() {
  const router = useRouter();

  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);

  // открыл "Открыть" (в рамках текущей страницы)
  const [opened, setOpened] = useState<Record<string, boolean>>({});
  // забрано локально
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

      const m: Record<string, boolean> = {};
      for (const o of list) {
        if (o?.id && o?.claimed) m[o.id] = true;
      }
      setClaimedLocal((prev) => ({ ...prev, ...m }));
    } catch {
      setToast({ type: "err", text: "Не удалось загрузить задания. Попробуй ещё раз." });
    } finally {
      setLoading(false);
    }
  }

  async function openOffer(offerId: string, url: string) {
    if (busyOpen) return;
    setBusyOpen(offerId);
    setToast(null);

    try {
      // фиксируем факт нажатия "Открыть"
      await fetch("/api/free/open", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        cache: "no-store",
        body: JSON.stringify({ offerId }),
      }).catch(() => null);

      // разблокируем "Забрать"
      setOpened((p) => ({ ...p, [offerId]: true }));

      // реально открываем ссылку
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
    try {
      tg()?.ready?.();
      tg()?.expand?.();
    } catch {}
    loadOffers();
  }, []);

  return (
    <div
      style={{
        minHeight: "100vh",
        paddingBottom: 110,
        paddingTop: 10,
        background:
          "radial-gradient(900px 340px at 15% 0%, rgba(255,255,255,0.96), rgba(246,242,234,1) 60%)",
      }}
    >
      {/* Top bar */}
      <div style={{ padding: "0 14px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 900, lineHeight: 1.05 }}>Бесплатно</div>
            <div style={{ fontSize: 13, opacity: 0.75, marginTop: 4 }}>
              Нажми <b>«Открыть»</b> → потом <b>«Забрать»</b>.
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <IconButton title="Обновить" onClick={loadOffers} disabled={loading}>
              ↻
            </IconButton>

            <button
              className="btn btnGhost"
              onClick={() => router.push("/")}
              style={{
                height: 42,
                borderRadius: 999,
                padding: "0 14px",
                background: "rgba(255,255,255,0.92)",
                border: "1px solid rgba(0,0,0,0.06)",
                boxShadow: "0 8px 18px rgba(0,0,0,0.05)",
                fontWeight: 900,
              }}
              title="На главную"
            >
              ← Назад
            </button>
          </div>
        </div>

        {/* Toast */}
        {toast ? (
          <div style={{ marginTop: 10 }}>
            <Card
              style={{
                padding: 12,
                background: toast.type === "ok" ? "rgba(46,204,113,0.10)" : "rgba(241,196,15,0.16)",
              }}
            >
              <div style={{ fontSize: 13 }}>
                {toast.type === "ok" ? "✅ " : "⚠️ "}
                {toast.text}
              </div>
            </Card>
          </div>
        ) : null}
      </div>

      {/* List */}
      <div style={{ padding: "14px 14px 0", display: "grid", gap: 12 }}>
        {loading ? (
          <div style={{ fontSize: 13, opacity: 0.75, padding: "0 2px" }}>Загрузка…</div>
        ) : null}

        {!loading && sortedOffers.length === 0 ? (
          <div style={{ fontSize: 13, opacity: 0.75, padding: "0 2px" }}>Пока нет доступных заданий.</div>
        ) : null}

        {sortedOffers.map((o) => {
          const alreadyClaimed = !!(o.claimed || claimedLocal[o.id]);
          const canClaim = !!opened[o.id] && !alreadyClaimed;

          return (
            <Card key={o.id}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 900, fontSize: 16, lineHeight: 1.2 }}>{o.title}</div>
                  <div style={{ fontSize: 12, opacity: 0.7, marginTop: 6, wordBreak: "break-all" }}>
                    {prettyUrl(o.url)}
                  </div>

                  <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <Tag>🎁 +{o.reward}</Tag>
                    {alreadyClaimed ? (
                      <Tag tone="good">✅ Забрано</Tag>
                    ) : opened[o.id] ? (
                      <Tag tone="good">🟢 Можно забрать</Tag>
                    ) : (
                      <Tag tone="warn">🔒 Сначала «Открыть»</Tag>
                    )}
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
                <button
                  className="btn btnPrimary"
                  style={{ borderRadius: 999, padding: "10px 14px", flex: 1, fontWeight: 900 }}
                  onClick={() => openOffer(o.id, o.url)}
                  disabled={busyOpen !== null || alreadyClaimed}
                >
                  {busyOpen === o.id ? "Открываю…" : "Открыть"}
                </button>

                <button
                  className="btn btnGhost"
                  style={{
                    borderRadius: 999,
                    padding: "10px 14px",
                    flex: 1,
                    opacity: canClaim ? 1 : 0.6,
                    fontWeight: 900,
                  }}
                  onClick={() => claimOffer(o.id)}
                  disabled={!canClaim || busyClaim !== null}
                  title={!opened[o.id] ? "Сначала нажми «Открыть»" : ""}
                >
                  {busyClaim === o.id ? "Проверяю…" : "Забрать"}
                </button>
              </div>

              {!alreadyClaimed && !opened[o.id] ? (
                <div style={{ fontSize: 12, opacity: 0.75, marginTop: 10 }}>
                  Нажми <b>«Открыть»</b>, чтобы разблокировать <b>«Забрать»</b>.
                </div>
              ) : null}
            </Card>
          );
        })}
      </div>
    </div>
  );
}