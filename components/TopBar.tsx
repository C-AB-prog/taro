"use client";

import { useState } from "react";
import { ShopModal } from "@/components/ShopModal";
import { IconPlus } from "@/components/Icons";

type User = { id: string; balance: number; username?: string; firstName?: string };
type Api = { user: User | null; refreshMe: () => Promise<void>; setUser: (u: User | null) => void };

export function TopBar({ api }: { api: Api }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="badge">
        <span style={{ fontSize: 12, color: "rgba(184,176,160,.95)" }}>✦</span>
        <span style={{ fontSize: 12, color: "rgba(184,176,160,.95)" }}>Баланс</span>
        <span style={{ fontWeight: 950 }}>{api.user?.balance ?? 0}</span>

        <button
          className="btn"
          style={{ padding: "8px 10px", borderRadius: 999, display: "grid", placeItems: "center" }}
          onClick={() => setOpen(true)}
          aria-label="Пополнить"
        >
          <IconPlus />
        </button>
      </div>

      <ShopModal open={open} onClose={() => setOpen(false)} api={api} />
    </>
  );
}
