"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type Offer = {
  id: string;
  title: string;
  url: string;
  reward: number;
  claimed: boolean;
};

function getTgInitData(): string {
  try {
    const w: any = window as any;
    return String(w?.Telegram?.WebApp?.initData || "").trim();
  } catch {
    return "";
  }
}

function tgOpenLink(url: string) {
  const w: any = window as any;
  const tg = w?.Telegram?.WebApp;
  if (tg?.openLink) tg.openLink(url);
  else window.open(url, "_blank");
}

export default function FreePage() {
  const router = useRouter();
  const initData = useMemo(() => getTgInitData(), []);

  const headers = useMemo(() => {
    const h: Record<string, string> = { "Content-Type": "application/json" };
    if (initData) h["x-tg-init-data"] = initData;
    return h;
  }, [initData]);

  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string>("");

  const fetchOffers = useCallback(async () => {
    setLoading(true);
    setMsg("");
    try {
      const r = await fetch("/api/free/offers", {
        method: "GET",
        headers,
        credentials: "include",
        cache: "no-store",
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j?.ok) throw new Error(j?.error || "FAILED");
      setOffers(Array.isArray(j.offers) ? j.offers : []);
    } catch {
      setOffers([]);
      setMsg("Не получилось загрузить задания. Нажми «↻».");
    } finally {
      setLoading(false);
    }
  }, [headers]);

  useEffect(() => {
    fetchOffers();
  }, [fetchOffers]);

  const onOpen = async (o: Offer) => {
    if (busyId) return;
    setBusyId(o.id);
    setMsg("");

    try {
      // ВАЖНО: этот endpoint должен быть тем, который "open + claim" (я тебе давал полный файл)
      const r = await fetch("/api/free/open", {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify({ offerId: o.id }),
      });
      const j = await r.json().catch(() => ({}));

      if (!r.ok || !j?.ok) {
        setMsg(j?.message ? `Ошибка: ${j.message}` : "Не получилось получить награду. Попробуй ещё раз.");
        return;
      }

      // помечаем как получено
      setOffers((prev) => prev.map((x) => (x.id === o.id ? { ...x, claimed: true } : x)));

      const reward = Number(j.reward || 0);
      if (reward > 0) setMsg(`✅ Получено +${reward}`);

      // открываем ссылку
      tgOpenLink(o.url);
    } catch {
      setMsg("Не получилось открыть/получить награду. Попробуй ещё раз.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      {/* Topbar (под твой дизайн) */}
      <div className="topbar">
        <div className="topbarInner">
          <div className="brandTitle">Бесплатно</div>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <button
              className="btn btnGhost pressable"
              style={{ padding: "10px 12px", borderRadius: 14 }}
              onClick={fetchOffers}
              disabled={loading || !!busyId}
              title="Обновить"
            >
              ↻
            </button>
            <button
              className="btn btnGhost pressable"
              style={{ padding: "10px 12px", borderRadius: 14 }}
              onClick={() => router.push("/")}
              title="На главную"
            >
              ← Назад
            </button>
          </div>
        </div>
      </div>

      <div className="container">
        <div className="h1" style={{ marginTop: 10 }}>Бесплатно</div>
        <div className="small" style={{ marginBottom: 12 }}>
          Нажми <b>«Открыть»</b> — награда начислится автоматически (1 раз), затем откроется ссылка.
        </div>

        {msg ? (
          <div className="adviceBox" style={{ marginBottom: 12 }}>
            <div className="adviceTitle">Сообщение</div>
            <div className="adviceText">⚠️ {msg}</div>
          </div>
        ) : null}

        {loading ? (
          <div className="card">
            <div className="title">Загрузка…</div>
            <div className="small" style={{ marginTop: 6 }}>
              Подожди немного.
            </div>
          </div>
        ) : offers.length === 0 ? (
          <div className="card">
            <div className="title">Пока нет доступных заданий.</div>
            <div className="small" style={{ marginTop: 6 }}>
              Нажми «↻», чтобы обновить.
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {offers.map((o) => {
              const disabled = !!busyId || o.claimed;
              return (
                <div key={o.id} className="card">
                  <div className="title">{o.title}</div>
                  <div className="small" style={{ marginTop: 6 }}>
                    {o.url.replace(/^https?:\/\//i, "")}
                  </div>

                  <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
                    <span className="badge" style={{ padding: "7px 10px" }}>
                      <span className="badgeDot" />
                      🎁 +{o.reward}
                    </span>

                    {o.claimed ? (
                      <span className="badge" style={{ padding: "7px 10px" }}>
                        ✅ Получено
                      </span>
                    ) : (
                      <span className="badge" style={{ padding: "7px 10px" }}>
                        ⏳ Нажми «Открыть»
                      </span>
                    )}
                  </div>

                  <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
                    <button
                      className={`btn btnPrimary pressable`}
                      style={{ flex: 1 }}
                      onClick={() => onOpen(o)}
                      disabled={disabled}
                    >
                      {o.claimed ? "Уже получено" : "Открыть"}
                    </button>
                  </div>

                  <div className="small" style={{ marginTop: 10 }}>
                    Награда выдаётся только один раз на кампанию.
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
