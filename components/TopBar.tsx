"use client";

import { useState } from "react";
import { ShopModal } from "@/components/ShopModal";

type User = { id: string; balance: number; username?: string; firstName?: string };
type Api = { user: User | null; refreshMe: () => Promise<void>; setUser: (u: User | null) => void };

export function TopBar({ api }: { api: Api }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="badge">
        <span style={{ fontSize: 12, color: "rgba(255,255,255,.75)" }}>Баланс</span>
        <span style={{ fontWeight: 950 }}>{api.user?.balance ?? 0}</span>
        <button
          className="btn"
          style={{ padding: "8px 10px", borderRadius: 999 }}
          onClick={() => setOpen(true)}
          aria-label="Пополнить"
        >
          +
        </button>
      </div>

      <ShopModal open={open} onClose={() => setOpen(false)} api={api} />
    </>
  );
}
