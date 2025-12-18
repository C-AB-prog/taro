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
  const [toast, setToast] = useState<string>("");

  const fetchOffers = useCallback(async () => {
    setLoading(true);
    setToast("");
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
      setToast("Не получилось загрузить задания. Обнови.");
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
    setToast("");

    try {
      // 1) начисляем (один раз) и фиксируем open на сервере
      const r = await fetch("/api/free/open", {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify({ offerId: o.id }),
      });
      const j = await r.json().catch(() => ({}));

      if (!r.ok || !j?.ok) {
        setToast(j?.message ? `Ошибка: ${j.message}` : "Не получилось получить награду. Попробуй ещё раз.");
        return;
      }

      // 2) обновим список, чтобы стало "Получено"
      setOffers((prev) => prev.map((x) => (x.id === o.id ? { ...x, claimed: true } : x)));

      // 3) откроем ссылку
      tgOpenLink(o.url);

      const reward = Number(j.reward || 0);
      if (reward > 0) setToast(`✅ Получено +${reward}`);
    } catch {
      setToast("Не получилось открыть/получить награду. Попробуй ещё раз.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#fbf6ea,rgba(251,246,234,0.6),#ffffff)]">
      <div className="mx-auto max-w-[520px] px-4 pb-10 pt-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-2xl font-extrabold tracking-tight">Бесплатно</div>
            <div className="mt-1 text-sm text-neutral-600">
              Нажми <b>«Открыть»</b> — награда начислится автоматически.
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={fetchOffers}
              disabled={loading || !!busyId}
              className="h-11 w-11 rounded-full bg-white shadow-sm ring-1 ring-black/5 active:scale-[0.99] disabled:opacity-60"
              aria-label="Обновить"
              title="Обновить"
            >
              ↻
            </button>

            <button
              onClick={() => router.push("/")}
              className="h-11 rounded-full bg-white px-4 shadow-sm ring-1 ring-black/5 active:scale-[0.99]"
              title="На главную"
            >
              ← Назад
            </button>
          </div>
        </div>

        {toast ? (
          <div className="mt-4 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-900 ring-1 ring-amber-200">
            ⚠️ {toast}
          </div>
        ) : null}

        <div className="mt-5 space-y-3">
          {loading ? (
            <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/5">
              <div className="text-sm text-neutral-600">Загрузка…</div>
            </div>
          ) : offers.length === 0 ? (
            <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/5">
              <div className="text-sm text-neutral-700">Пока нет доступных заданий.</div>
            </div>
          ) : (
            offers.map((o) => (
              <div key={o.id} className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-black/5">
                <div className="text-lg font-bold">{o.title}</div>
                <div className="mt-1 text-sm text-neutral-500">{o.url.replace(/^https?:\/\//i, "")}</div>

                <div className="mt-3 flex items-center gap-2">
                  <span className="inline-flex items-center gap-2 rounded-full bg-rose-50 px-3 py-1 text-sm font-semibold text-rose-700 ring-1 ring-rose-100">
                    🎁 +{o.reward}
                  </span>

                  {o.claimed ? (
                    <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-700 ring-1 ring-emerald-100">
                      ✅ Получено
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-2 rounded-full bg-neutral-50 px-3 py-1 text-sm font-semibold text-neutral-600 ring-1 ring-neutral-100">
                      ⏳ Нажми «Открыть»
                    </span>
                  )}
                </div>

                <div className="mt-4">
                  <button
                    onClick={() => onOpen(o)}
                    disabled={!!busyId || o.claimed}
                    className="h-12 w-full rounded-full bg-amber-50 font-semibold text-amber-900 ring-1 ring-amber-200 active:scale-[0.99] disabled:opacity-60"
                  >
                    Открыть
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
