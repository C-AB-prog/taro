"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Modal } from "@/components/Modal";

type Props = { children: React.ReactNode };

function IconHome(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <path
        d="M4 10.5L12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6h-4v6H5a1 1 0 0 1-1-1v-9.5Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function IconSpark(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <path
        d="M12 2l1.2 5.2L18 9l-4.8 1.8L12 16l-1.2-5.2L6 9l4.8-1.8L12 2Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M19 12l.6 2.6L22 15.5l-2.4.9L19 19l-.6-2.6L16 15.5l2.4-.9L19 12Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function IconGrid(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <path
        d="M4 4h7v7H4V4Zm9 0h7v7h-7V4ZM4 13h7v7H4v-7Zm9 0h7v7h-7v-7Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function IconClock(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <path
        d="M12 22a10 10 0 1 1 0-20 10 10 0 0 1 0 20Z"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="M12 6v6l4 2"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

async function fetchBalance(): Promise<number | null> {
  const urls = ["/api/me", "/api/user", "/api/balance"];
  for (const url of urls) {
    try {
      const r = await fetch(url, { cache: "no-store" });
      if (!r.ok) continue;
      const d = await r.json().catch(() => ({}));
      const b =
        d?.balance ?? d?.user?.balance ?? d?.me?.balance ?? d?.data?.balance ?? null;
      if (typeof b === "number") return b;
      const nb = Number(b);
      if (Number.isFinite(nb)) return nb;
    } catch {}
  }
  return null;
}

type PackId = "pack_99" | "pack_199" | "pack_399" | "pack_799";

const PACKS: Array<{ id: PackId; label: string; hint: string }> = [
  { id: "pack_99", label: "99 Stars → 150 валюты", hint: "Быстро пополнить запас" },
  { id: "pack_199", label: "199 Stars → 350 валюты", hint: "Самый популярный" },
  { id: "pack_399", label: "399 Stars → 800 валюты", hint: "Выгодно для раскладов" },
  { id: "pack_799", label: "799 Stars → 1800 валюты", hint: "Максимум выгоды" },
];

const PACK_COINS: Record<PackId, number> = {
  pack_99: 150,
  pack_199: 350,
  pack_399: 800,
  pack_799: 1800,
};

export function AppShell({ children }: Props) {
  const pathname = usePathname();
  const nav = useMemo(
    () => [
      { href: "/", label: "Главная", icon: IconHome },
      { href: "/spreads", label: "Расклады", icon: IconSpark },
      { href: "/deck", label: "Колода", icon: IconGrid },
      { href: "/archive", label: "Архив", icon: IconClock },
    ],
    []
  );

  const [balance, setBalance] = useState<number | null>(null);
  const [shopOpen, setShopOpen] = useState(false);

  const [buying, setBuying] = useState<PackId | null>(null);
  const [shopMsg, setShopMsg] = useState<string | null>(null);
  const [shopErr, setShopErr] = useState<string | null>(null);

  async function refreshBalance() {
    const b = await fetchBalance();
    setBalance(b);
  }

  useEffect(() => {
    const tg = (globalThis as any)?.Telegram?.WebApp;
    try {
      tg?.ready?.();
      tg?.expand?.();
    } catch {}

    refreshBalance();

    const on = () => refreshBalance();
    window.addEventListener("balance:refresh", on);
    return () => window.removeEventListener("balance:refresh", on);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function buyPack(packId: PackId) {
    if (buying) return;

    setBuying(packId);
    setShopErr(null);
    setShopMsg("Открываю оплату…");

    const before = typeof balance === "number" ? balance : null;
    const expected = PACK_COINS[packId];

    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

    async function pollBalance(timeoutMs = 12000) {
      const start = Date.now();
      while (Date.now() - start < timeoutMs) {
        const b = await fetchBalance();
        if (typeof b === "number") {
          setBalance(b);

          if (before !== null) {
            if (b >= before + expected) return { ok: true as const, newBalance: b, delta: b - before };
          } else {
            return { ok: true as const, newBalance: b, delta: expected };
          }
        }
        await sleep(900);
      }
      return { ok: false as const };
    }

    try {
      const r = await fetch("/api/shop/invoice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packId }),
      });

      const data = await r.json().catch(() => ({}));
      if (!r.ok || !data?.ok || !data?.invoiceLink) {
        setShopMsg(null);
        setShopErr(
          data?.error === "UNAUTHORIZED"
            ? "Нет сессии. Открой мини-приложение через Telegram."
            : data?.error
            ? `Сервер: ${data.error}`
            : "Не удалось создать счёт. Попробуй ещё раз."
        );
        setBuying(null);
        return;
      }

      const tg = (globalThis as any)?.Telegram?.WebApp;
      if (!tg?.openInvoice) {
        setShopMsg(null);
        setShopErr("Оплата доступна только внутри Telegram.");
        setBuying(null);
        return;
      }

      tg.openInvoice(String(data.invoiceLink), async (status: string) => {
        if (status === "paid") {
          setShopErr(null);
          setShopMsg("Оплата принята. Проверяю начисление…");

          window.dispatchEvent(new Event("balance:refresh"));

          const res = await pollBalance();

          if (res.ok) {
            setShopMsg(`Готово! +${res.delta} валюты ✨`);
            (globalThis as any)?.Telegram?.WebApp?.HapticFeedback?.notificationOccurred?.("success");

            setTimeout(() => {
              setShopMsg(null);
              setShopOpen(false);
            }, 1600);
          } else {
            setShopMsg(null);
            setShopErr("Платёж принят, но баланс обновляется дольше обычного. Подожди пару секунд и открой магазин снова.");
          }

          setBuying(null);
          return;
        }

        if (status === "cancelled") {
          setShopMsg(null);
          setShopErr("Платёж отменён.");
          setBuying(null);
          return;
        }

        if (status === "failed") {
          setShopMsg(null);
          setShopErr("Платёж не прошёл.");
          setBuying(null);
          return;
        }

        setShopMsg(null);
        setBuying(null);
      });
    } catch {
      setShopMsg(null);
      setShopErr("Ошибка сети. Попробуй ещё раз.");
      setBuying(null);
    }
  }

  return (
    <>
      <div className="topbar">
        <div className="topbarInner">
          <div className="brandTitle">Карта Дня | Daily Tarot</div>

          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <div className="badge" aria-label="Баланс">
              <span className="badgeDot" aria-hidden="true" />
              Баланс&nbsp;<b>{balance === null ? "—" : balance}</b>
            </div>

            <button
              type="button"
              className="btn btnGhost"
              style={{ padding: "8px 12px", borderRadius: 999 }}
              onClick={() => {
                setShopErr(null);
                setShopMsg(null);
                setShopOpen(true);
              }}
              aria-label="Открыть магазин"
            >
              +
            </button>
          </div>
        </div>
      </div>

      <main className="container">{children}</main>

      <div className="nav navFloat">
        <div className="navPill">
          <div className="navInner">
            {nav.map((item) => {
              const active = item.href === "/" ? pathname === "/" : pathname?.startsWith(item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`navItem ${active ? "navItemActive" : ""}`}
                  aria-current={active ? "page" : undefined}
                >
                  <Icon className="icon" />
                  <div className="navLabel">{item.label}</div>
                  <div className="navDot" />
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      <Modal open={shopOpen} title="Магазин" onClose={() => setShopOpen(false)}>
        <div className="small">
          Пополнение внутренней валюты через Telegram Stars. Начисление обычно занимает пару секунд.
        </div>

        <div style={{ height: 12 }} />

        {PACKS.map((p) => (
          <div key={p.id} style={{ marginBottom: 10 }}>
            <button
              className="btn btnPrimary"
              style={{ width: "100%" }}
              disabled={!!buying}
              onClick={() => buyPack(p.id)}
            >
              {buying === p.id ? "Ожидаю оплату…" : p.label}
            </button>
            <div className="small" style={{ marginTop: 6, opacity: 0.85 }}>
              {p.hint}
            </div>
          </div>
        ))}

        {shopMsg ? (
          <div className="small" style={{ marginTop: 10 }}>
            {shopMsg}
          </div>
        ) : null}

        {shopErr ? (
          <div className="small" style={{ marginTop: 10 }}>
            <b>Не получилось:</b> {shopErr}
          </div>
        ) : null}
      </Modal>
    </>
  );
}
