"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconHome, IconSpread, IconDeck, IconArchive } from "@/components/Icons";

export function BottomNav() {
  const p = usePathname();

  const item = (href: string, label: string, Icon: any) => {
    const active = p === href;
    return (
      <Link className={`navItem ${active ? "navItemActive" : ""}`} href={href}>
        <Icon />
        <div>{label}</div>
      </Link>
    );
  };

  return (
    <div className="nav">
      <div className="navInner">
        {item("/", "Главная", IconHome)}
        {item("/spreads", "Расклады", IconSpread)}
        {item("/deck", "Колода", IconDeck)}
        {item("/archive", "Архив", IconArchive)}
      </div>
    </div>
  );
}
