"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function BottomNav() {
  const p = usePathname();
  const item = (href: string, label: string) => {
    const active = p === href;
    return (
      <Link className={`navItem ${active ? "navItemActive" : ""}`} href={href}>
        {label}
      </Link>
    );
  };

  return (
    <div className="nav">
      <div className="navInner">
        {item("/", "Главная")}
        {item("/spreads", "Расклады")}
        {item("/deck", "Колода")}
        {item("/archive", "Архив")}
      </div>
    </div>
  );
}
