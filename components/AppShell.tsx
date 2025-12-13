"use client";

import { useEffect, useMemo, useState } from "react";
import { BottomNav } from "@/components/BottomNav";
import { TopBar } from "@/components/TopBar";
import { LoadingScreen } from "@/components/LoadingScreen";

type User = { id: string; balance: number; username?: string; firstName?: string };

export function AppShell({ title, children }: { title: string; children: React.ReactNode }) {
  const [status, setStatus] = useState<"loading" | "need_tg" | "error" | "ok">("loading");
  const [user, setUser] = useState<User | null>(null);

  async function refreshMe() {
    const me = await fetch("/api/me", { cache: "no-store" });
    if (!me.ok) throw new Error("me_failed");
    const data = await me.json();
    setUser(data.user);
  }

  useEffect(() => {
    async function boot() {
      const tg = window.Telegram?.WebApp;
      if (!tg?.initData) {
        setStatus("need_tg");
        return;
      }

      try {
        tg.ready();
        tg.expand?.();

        // сначала пробуем me (вдруг кука уже есть)
        const meTry = await fetch("/api/me", { cache: "no-store" });
        if (meTry.ok) {
          const data = await meTry.json();
          setUser(data.user);
          setStatus("ok");
          return;
        }

        // если нет — логинимся initData
        const auth = await fetch("/api/auth/telegram", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ initData: tg.initData }),
        });
        if (!auth.ok) throw new Error("auth_failed");

        await refreshMe();
        setStatus("ok");
      } catch {
        setStatus("error");
      }
    }

    boot();
  }, []);

  const api = useMemo(
    () => ({
      user,
      refreshMe,
      setUser,
    }),
    [user]
  );

  if (status === "loading") return <LoadingScreen />;
  if (status === "need_tg")
    return (
      <div className="container">
        <div className="h1">Открой в Telegram</div>
        <p className="text">Это мини-приложение работает внутри Telegram.</p>
      </div>
    );
  if (status === "error")
    return (
      <div className="container">
        <div className="h1">Ошибка</div>
        <p className="text">Не удалось авторизоваться. Проверь BOT_TOKEN и подключение Mini App.</p>
      </div>
    );

  return (
    <>
      <div className="topbar">
        <div className="topbarInner">
          <div className="brand">
            <div className="brandTitle">{title}</div>
            <div className="brandSub">Карта Дня • Daily Tarot</div>
          </div>
          <TopBar api={api} />
        </div>
      </div>

      <div className="container">{children}</div>
      <BottomNav />
    </>
  );
}
