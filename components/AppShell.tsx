"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Modal } from "@/components/Modal";

/* ================= icons ================= */

function IconHome(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <path d="M4 10.5L12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6h-4v6H5a1 1 0 0 1-1-1v-9.5Z" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}
function IconSpark(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <path d="M12 2l1.2 5.2L18 9l-4.8 1.8L12 16l-1.2-5.2L6 9l4.8-1.8L12 2Z" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}
function IconGrid(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <path d="M4 4h7v7H4V4Zm9 0h7v7h-7V4ZM4 13h7v7H4v-7Zm9 0h7v7h-7v-7Z" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}
function IconClock(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <path d="M12 22a10 10 0 1 1 0-20 10 10 0 0 1 0 20Z" stroke="currentColor" strokeWidth="2" />
      <path d="M12 6v6l4 2" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

/* ================= shop packs (Stars) ================= */

type PackId = "pack_99" | "pack_199" | "pack_399" | "pack_799";

const PACKS: Array<{ id: PackId; label: string; hint: string }> = [
  { id: "pack_99", label: "99 ⭐ → 150 валюты", hint: "Быстро" },
  { id: "pack_199", label: "199 ⭐ → 350 валюты", hint: "Популярно" },
  { id: "pack_399", label: "399 ⭐ → 800 валюты", hint: "Выгодно" },
  { id: "pack_799", label: "799 ⭐ → 1800 валюты", hint: "Максимум" },
];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/* ================= Telegram helpers ================= */

function getInitData(): string {
  try {
    return (globalThis as any)?.Telegram?.WebApp?.initData || "";
  } catch {
    return "";
  }
}

async function waitInitData(timeout = 8000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    const d = getInitData();
    if (d) return d;
    await sleep(120);
  }
  return "";
}

function wrapFetch() {
  const g: any = globalThis as any;
  if (g.__tgFetchWrapped) return;

  const orig = g.fetch.bind(globalThis);
  g.fetch = (input: any, init?: any) => {
    let url = "";
    if (typeof input === "string") url = input;
    else if (input?.url) url = input.url;

    const isApi = typeof url === "string" && url.startsWith("/api/");
    if (isApi) {
      const headers = new Headers(init?.headers || {});
      const initData = getInitData();
      if (initData) {
        headers.set("x-tg-init-data", initData);
        headers.set("x-telegram-init-data", initData);
      }
      return orig(input, {
        ...init,
        headers,
        credentials: "include",
        cache: "no-store",
      });
    }

    return orig(input, init);
  };

  g.__tgFetchWrapped = true;
}

async function ensureSession() {
  const initData = await waitInitData();
  if (!initData) return;

  await fetch("/api/auth/telegram", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ initData }),
    credentials: "include",
    cache: "no-store",
  }).catch(() => null);
}

/* ================= component ================= */

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

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
  const [shopErr, setShopErr] = useState<string | null>(null);

  async function refreshBalance() {
    try {
      const r = await fetch("/api/me", { cache: "no-store", credentials: "include" });
      if (!r.ok) {
        setBalance(null);
        return;
      }
      const d = await r.json().catch(() => ({}));
      const b = d?.balance ?? d?.user?.balance;
      const nb = Number(b);
      setBalance(Number.isFinite(nb) ? nb : null);
    } catch {
      setBalance(null);
    }
  }

  async function buyPack(packId: PackId) {
    if (buying) return;
    setBuying(packId);
    setShopErr(null);

    try {
      const r = await fetch("/api/shop/invoice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packId }),
        credentials: "include",
        cache: "no-store",
      });

      const d = await r.json().catch(() => ({}));
      if (!r.ok || !d?.invoiceLink) {
        setShopErr(d?.error ? String(d.error) : "Не удалось создать счёт");
        setBuying(null);
        return;
      }

      const tg = (globalThis as any)?.Telegram?.WebApp;
      if (!tg?.openInvoice) {
        setShopErr("Открой мини-приложение внутри Telegram");
        setBuying(null);
        return;
      }

      tg.openInvoice(String(d.invoiceLink), async (status: string) => {
        if (status === "paid") {
          await sleep(900);
          await refreshBalance();
          window.dispatchEvent(new Event("balance:refresh"));
        }
        setBuying(null);
      });
    } catch {
      setShopErr("Ошибка сети");
      setBuying(null);
    }
  }

  useEffect(() => {
    wrapFetch();

    const tg = (globalThis as any)?.Telegram?.WebApp;
    try {
      tg?.ready?.();
      tg?.expand?.();
    } catch {}

    ensureSession().then(refreshBalance);

    window.addEventListener("balance:refresh", refreshBalance);
    return () => window.removeEventListener("balance:refresh", refreshBalance);
  }, []);

  return (
    <>
      {/* TOP BAR */}
      <div className="topbar">
        <div className="topbarInner">
          <div className="brandTitle">Daily Tarot</div>

          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <div className="badge">
              Баланс&nbsp;<b>{balance === null ? "—" : balance}</b>
            </div>

            <button
              type="button"
              className="btn btnGhost"
              style={{ padding: "8px 12px", borderRadius: 999 }}
              onClick={() => {
                setShopErr(null);
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

      {/* NAV */}
      <div className="nav navFloat">
        <div className="navPill">
          <div className="navInner">
            {nav.map((item) => {
              const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
              const Icon = item.icon;
              return (
                <Link key={item.href} href={item.href} className={`navItem ${active ? "navItemActive" : ""}`}>
                  <Icon className="icon" />
                  <div className="navLabel">{item.label}</div>
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      {/* SHOP MODAL */}
      <Modal open={shopOpen} title="Магазин" onClose={() => setShopOpen(false)}>
        {/* ✅ КНОПКА "БЕСПЛАТНО" */}
        <button
          className="btn btnPrimary"
          style={{ width: "100%", borderRadius: 999 }}
          onClick={() => {
            setShopOpen(false);
            router.push("/free");
          }}
        >
          Бесплатно
        </button>

        <div style={{ height: 12 }} />

        {PACKS.map((p) => (
          <div key={p.id} style={{ marginBottom: 10 }}>
            <button className="btn btnPrimary" disabled={!!buying} onClick={() => buyPack(p.id)} style={{ width: "100%" }}>
              {buying === p.id ? "Ожидаю оплату…" : p.label}
            </button>
            <div className="small">{p.hint}</div>
          </div>
        ))}

        {shopErr ? (
          <div className="small" style={{ marginTop: 10 }}>
            <b>Ошибка:</b> {shopErr}
          </div>
        ) : null}
      </Modal>
    </>
  );
}
