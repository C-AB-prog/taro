"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Modal } from "@/components/Modal";

type Props = { children: React.ReactNode };

function IconHome(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <path d="M4 10.5L12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6h-4v6H5a1 1 0 0 1-1-1v-9.5Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}
function IconSpark(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <path d="M12 2l1.2 5.2L18 9l-4.8 1.8L12 16l-1.2-5.2L6 9l4.8-1.8L12 2Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M19 12l.6 2.6L22 15.5l-2.4.9L19 19l-.6-2.6L16 15.5l2.4-.9L19 12Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}
function IconGrid(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" {...props}>
      <path d="M4 4h7v7H4V4Zm9 0h7v7h-7V4ZM4 13h7v7H4v-7Zm9 0h7v7h-7v-7Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
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

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function getTgInitDataSync(): string {
  try {
    const tg = (globalThis as any)?.Telegram?.WebApp;
    const initData = tg?.initData;
    return typeof initData === "string" ? initData : "";
  } catch {
    return "";
  }
}

async function waitForInitData(timeoutMs = 12000): Promise<string> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const initData = getTgInitDataSync();
    if (initData) return initData;
    await sleep(120);
  }
  return "";
}

function installApiFetchDynamic() {
  const g: any = globalThis as any;
  if (g.__tgFetchWrapped) return;

  const origFetch = g.fetch?.bind(globalThis);
  if (!origFetch) return;

  g.fetch = (input: any, init?: any) => {
    try {
      let urlStr = "";
      if (typeof input === "string") urlStr = input;
      else if (input instanceof URL) urlStr = input.toString();
      else if (input && typeof input.url === "string") urlStr = input.url;

      const isApi =
        typeof urlStr === "string" &&
        (urlStr.startsWith("/api/") ||
          (() => {
            try {
              const u = new URL(urlStr, window.location.origin);
              return u.origin === window.location.origin && u.pathname.startsWith("/api/");
            } catch {
              return false;
            }
          })());

      if (!isApi) return origFetch(input, init);

      const initData = getTgInitDataSync();

      const headers = new Headers(init?.headers || {});
      if (initData) {
        if (!headers.has("x-tg-init-data")) headers.set("x-tg-init-data", initData);
        if (!headers.has("x-telegram-init-data")) headers.set("x-telegram-init-data", initData);
      }

      return origFetch(input, {
        ...init,
        headers,
        credentials: init?.credentials ?? "include",
        cache: init?.cache ?? "no-store",
      });
    } catch {
      return origFetch(input, init);
    }
  };

  g.__tgFetchWrapped = true;
}

if (typeof window !== "undefined") {
  installApiFetchDynamic();
}

async function ensureSession(initData: string): Promise<{ ok: boolean; status: number }> {
  if (!initData) return { ok: false, status: 0 };
  try {
    const r = await fetch("/api/auth/telegram", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      cache: "no-store",
      body: JSON.stringify({ initData }),
    });
    return { ok: r.ok, status: r.status };
  } catch {
    return { ok: false, status: 0 };
  }
}

export function AppShell({ children }: Props) {
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

  // DEBUG
  const [dbgInitLen, setDbgInitLen] = useState<number>(0);
  const [dbgAuth, setDbgAuth] = useState<string>("—");
  const [dbgMe, setDbgMe] = useState<string>("—");
  const [dbgMeExtra, setDbgMeExtra] = useState<string>("");

  async function refreshBalance() {
    const initData = await waitForInitData(7000);
    setDbgInitLen(initData.length);

    const auth = await ensureSession(initData);
    setDbgAuth(`${auth.ok ? "ok" : "fail"} (${auth.status})`);

    try {
      const r = await fetch("/api/me", { cache: "no-store", credentials: "include" });
      const txt = `${r.ok ? "ok" : "fail"} (${r.status})`;
      setDbgMe(txt);

      const d = await r.json().catch(() => ({}));
      const b = d?.balance ?? d?.user?.balance ?? null;
      const nb = Number(b);

      if (Number.isFinite(nb)) setBalance(nb);
      else setBalance(null);

      if (d?.debug) {
        setDbgMeExtra(
          `hdr=${d.debug.hasInitDataHeader ? "1" : "0"} len=${d.debug.initDataHeaderLen} cookie=${d.debug.hasCookie ? "1" : "0"}`
        );
      } else {
        setDbgMeExtra("");
      }
    } catch {
      setBalance(null);
      setDbgMe("fail (0)");
      setDbgMeExtra("");
    }
  }

  useEffect(() => {
    const run = async () => {
      const tg = (globalThis as any)?.Telegram?.WebApp;
      try {
        tg?.ready?.();
        tg?.expand?.();
      } catch {}

      await refreshBalance();
    };

    run();

    const on = () => refreshBalance();
    window.addEventListener("balance:refresh", on);
    return () => window.removeEventListener("balance:refresh", on);
  }, []);

  return (
    <>
      {/* DEBUG BAR */}
      <div style={{ padding: 8, fontSize: 12, opacity: 0.9 }}>
        <b>DEBUG:</b> initDataLen={dbgInitLen} | auth={dbgAuth} | me={dbgMe} {dbgMeExtra ? `| ${dbgMeExtra}` : ""}
      </div>

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
              onClick={() => router.push("/free")}
              aria-label="Бесплатно"
            >
              Free
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
    </>
  );
}
