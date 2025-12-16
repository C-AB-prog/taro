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

type MeResp =
  | { ok: true; user?: { id: string }; balance?: number }
  | { ok: false; error?: string };

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

  try {
    window.open(u, "_blank", "noopener,noreferrer");
  } catch {}
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
        border: "1px solid rgba(255,255,255,0.10)",
        background: "rgba(255,255,255,0.03)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function Chip({
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
    border: "1px solid rgba(255,255,255,0.10)",
    background: "rgba(255,255,255,0.06)",
    opacity: 0.95,
    userSelect: "none",
  };

  if (tone === "good") {
    base.border = "1px solid rgba(255,255,255,0.14)";
    base.background = "rgba(255,255,255,0.10)";
  }
  if (tone === "warn") {
    base.border = "1px solid rgba(255,255,255,0.14)";
    base.background = "rgba(255,255,255,0.08)";
  }

  return <span style={base}>{children}</span>;
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

  // referral
  const [myUserId, setMyUserId] = useState<string>("");
  const botUsername = (process.env.NEXT_PUBLIC_BOT_USERNAME || "tarotday1_bot").replace(/^@/, "");
  const refLink = myUserId ? `https://t.me/${botUsername}?start=ref_${myUserId}` : "";

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

  async function loadMe() {
    try {
      const r = await fetch("/api/me", { credentials: "include", cache: "no-store" });
      const d: MeResp = await r.json().catch(() => ({ ok: false }));
      if ((d as any)?.ok && (d as any)?.user?.id) setMyUserId((d as any).user.id);
    } catch {}
  }

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

  async function copyText(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setToast({ type: "ok", text: "Скопировано ✅" });
    } catch {
      setToast({ type: "err", text: "Не получилось скопировать 😕" });
    }
  }

  function shareRef() {
    if (!refLink) return;
    // telegram share
    openTgLink(`https://t.me/share/url?url=${encodeURIComponent(refLink)}`);
  }

  function closePage() {
    try {
      const t = tg();
      if (t?.close) {
        t.close();
        return;
      }
    } catch {}
    router.push("/");
  }

  useEffect(() => {
    try {
      tg()?.ready?.();
      tg()?.expand?.();
    } catch {}
    loadMe();
    loadOffers();
  }, []);

  return (
    <div style={{ paddingBottom: 110 }}>
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

          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button
              className="btn btnGhost"
              style={{ borderRadius: 999, padding: "10px 14px", whiteSpace: "nowrap" }}
              onClick={loadOffers}
              disabled={loading}
            >
              {loading ? "…" : "Обновить"}
            </button>
            <button
              className="btn btnGhost"
              style={{ borderRadius: 999, padding: "10px 14px", whiteSpace: "nowrap" }}
              onClick={closePage}
            >
              Закрыть
            </button>
          </div>
        </div>

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

      {/* Referral */}
      <div style={{ marginTop: 12 }}>
        <Card>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 800, fontSize: 16, lineHeight: 1.15 }}>Рефералка</div>
              <div className="small" style={{ marginTop: 6, opacity: 0.85 }}>
                Отправь другу ссылку — если он новый пользователь, тебе начислится <b>+500</b>.
              </div>

              <div
                className="small"
                style={{
                  marginTop: 10,
                  padding: "10px 12px",
                  borderRadius: 14,
                  border: "1px solid rgba(255,255,255,0.10)",
                  background: "rgba(255,255,255,0.06)",
                  wordBreak: "break-all",
                  userSelect: "text",
                  opacity: refLink ? 0.95 : 0.6,
                }}
              >
                {refLink || "Загрузка ссылки…"}
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 140 }}>
              <button
                className="btn btnPrimary"
                style={{ borderRadius: 999, padding: "10px 14px" }}
                onClick={() => refLink && copyText(refLink)}
                disabled={!refLink}
              >
                Скопировать
              </button>

              <button
                className="btn btnGhost"
                style={{ borderRadius: 999, padding: "10px 14px" }}
                onClick={shareRef}
                disabled={!refLink}
              >
                Поделиться
              </button>
            </div>
          </div>
        </Card>
      </div>

      {/* Offers */}
      <div style={{ marginTop: 12, display: "grid", gap: 12 }}>
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
            <Card key={o.id}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 800, fontSize: 16, lineHeight: 1.15 }}>{o.title}</div>

                  {/* URL visible but not clickable */}
                  <div
                    className="small"
                    style={{
                      marginTop: 6,
                      opacity: 0.75,
                      wordBreak: "break-all",
                      userSelect: "text",
                    }}
                  >
                    {prettyUrl(o.url)}
                  </div>

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
            </Card>
          );
        })}
      </div>
    </div>
  );
}
