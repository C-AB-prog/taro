"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Modal } from "@/components/Modal";

type Props = {
  children: React.ReactNode;
};

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
      <path d="M12 22a10 10 0 1 1 0-20 10 10 0 0 1 0 20Z" stroke="currentColor" strokeWidth="2" />
      <path d="M12 6v6l4 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
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
      const b = d?.balance ?? d?.user?.balance ?? d?.me?.balance ?? d?.data?.balance ?? null;
      if (typeof b === "number") return b;
      const nb = Number(b);
      if (Number.isFinite(nb)) return nb;
    } catch {}
  }
  return null;
}

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

  useEffect(() => {
    const tg = (globalThis as any)?.Telegram?.WebApp;
    try {
      tg?.ready?.();
      tg?.expand?.();
    } catch {}

    (async () => {
      const b = await fetchBalance();
      setBalance(b);
    })();
  }, []);

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
              onClick={() => setShopOpen(true)}
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
        <div className="small">Покупка за Telegram Stars — заглушка. Скоро подключим.</div>

        <div style={{ height: 12 }} />

        <button className="btn btnPrimary" style={{ width: "100%" }} disabled>
          99 Stars → 150 валюты
        </button>
        <div style={{ height: 8 }} />
        <button className="btn btnPrimary" style={{ width: "100%" }} disabled>
          199 Stars → 350 валюты
        </button>
        <div style={{ height: 8 }} />
        <button className="btn btnPrimary" style={{ width: "100%" }} disabled>
          399 Stars → 800 валюты
        </button>
        <div style={{ height: 8 }} />
        <button className="btn btnPrimary" style={{ width: "100%" }} disabled>
          799 Stars → 1800 валюты
        </button>
      </Modal>
    </>
  );
}
