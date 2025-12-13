"use client";

import { useEffect, useState } from "react";

export function TgAuthGate({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<"loading" | "ok" | "need_tg" | "error">("loading");
  const [balance, setBalance] = useState<number>(0);

  useEffect(() => {
    async function run() {
      const tg = window.Telegram?.WebApp;
      if (!tg?.initData) {
        setStatus("need_tg");
        return;
      }

      try {
        tg.ready();
        tg.expand?.();

        // логинимся (поставит httpOnly cookie)
        const r = await fetch("/api/auth/telegram", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ initData: tg.initData }),
        });

        if (!r.ok) throw new Error("auth_failed");

        const me = await fetch("/api/me");
        if (!me.ok) throw new Error("me_failed");

        const data = await me.json();
        setBalance(data.user.balance);
        setStatus("ok");
      } catch {
        setStatus("error");
      }
    }

    run();
  }, []);

  if (status === "loading") return <div className="container"><div className="h1">Загрузка…</div></div>;
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
        <p className="text">Не удалось авторизоваться. Проверь BOT_TOKEN и правильность initData.</p>
      </div>
    );

  return (
    <>
      <div className="container">
        <div className="small">Баланс: <b>{balance}</b></div>
        {children}
      </div>
    </>
  );
}
