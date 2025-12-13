"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Modal } from "@/components/Modal";

function IconHome({ active }: { active: boolean }) {
  return (
    <svg className="icon" viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ opacity: active ? 1 : 0.75 }}>
      <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5Z" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}
function IconSpreads({ active }: { active: boolean }) {
  return (
    <svg className="icon" viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ opacity: active ? 1 : 0.75 }}>
      <path d="M7 7h10v14H7V7Z" stroke="currentColor" strokeWidth="2" />
      <path d="M5 3h10v4" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}
function IconDeck({ active }: { active: boolean }) {
  return (
    <svg className="icon" viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ opacity: active ? 1 : 0.75 }}>
      <path d="M7 4h10v16H7V4Z" stroke="currentColor" strokeWidth="2" />
      <path d="M5 6h2M17 6h2" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}
function IconArchive({ active }: { active: boolean }) {
  return (
    <svg className="icon" viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{ opacity: active ? 1 : 0.75 }}>
      <path d="M4 7h16v14H4V7Z" stroke="currentColor" strokeWidth="2" />
      <path d="M6 3h12v4H6V3Z" stroke="currentColor" strokeWidth="2" />
      <path d="M9 11h6" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

async function fetchBalance(): Promise<number | null> {
  // поддержим разные роуты — где-то у тебя /api/me, где-то /api/user
  const urls = ["/api/me", "/api/user", "/api/profile"];
  for (const u of urls) {
    try {
      const r = await fetch(u, { cache: "no-store" });
      if (r.status === 404) continue;
      const d = await r.json().catch(() => ({}));
      if (!r.ok) continue;

      const b =
        typeof d?.balance === "number"
          ? d.balance
          : typeof d?.user?.balance === "number"
          ? d.user.balance
          : null;

      if (typeof b === "number") return b;
    } catch {
      // ignore
    }
  }
  return null;
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [balance, setBalance] = useState<number | null>(null);
  const [shopOpen, setShopOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const b = await fetchBalance();
      if (!cancelled) setBalance(b);
    })();
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  const nav = [
    { href: "/", label: "Главная", icon: IconHome },
    { href: "/spreads", label: "Расклады", icon: IconSpreads },
    { href: "/deck", label: "Колода", icon: IconDeck },
    { href: "/archive", label: "Архив", icon: IconArchive },
  ];

  return (
    <>
      {/* TOPBAR: только название + баланс + плюс */}
      <div className="topbar">
        <div className="topbarInner">
          <div className="brand">
            <div className="brandTitle">Карта Дня | Daily Tarot</div>
          </div>

          <div className="row" style={{ alignItems: "center", gap: 8 }}>
            <div className="badge" style={{ padding: "8px 10px" }}>
              ✦ {balance === null ? "—" : balance}
            </div>
            <button
              className="btn btnPrimary"
              style={{ padding: "10px 12px", borderRadius: 14, width: 42 }}
              onClick={() => setShopOpen(true)}
              aria-label="Магазин"
            >
              +
            </button>
          </div>
        </div>
      </div>

      <div className="container">{children}</div>

      {/* Bottom nav остаётся */}
      <div className="nav navFloat">
        <div className="navPill">
          <div className="navInner navInnerPremium">
            {nav.map((n) => {
              const active = pathname === n.href;
              const Ico = n.icon;
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  className={`navItem ${active ? "navItemActive" : ""}`}
                >
                  <Ico active={active} />
                  <div className={`navLabel ${active ? "navLabelActive" : ""}`}>{n.label}</div>
                  <div className="navDot" />
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      {/* Магазин-заглушка */}
      <Modal open={shopOpen} title="Магазин" onClose={() => setShopOpen(false)}>
        <div className="small">Telegram Stars подключим позже — сейчас это заглушка.</div>
        <div style={{ height: 10 }} />
        <div className="card" style={{ padding: 12 }}>
          <div className="title">Паки валюты</div>
          <div className="small" style={{ marginTop: 6 }}>
            99 ⭐ → 150 • 199 ⭐ → 350 • 399 ⭐ → 800 • 799 ⭐ → 1800
          </div>
        </div>
      </Modal>
    </>
  );
}
