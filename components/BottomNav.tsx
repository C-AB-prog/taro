"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconArchive, IconDeck, IconHome, IconSpread } from "@/components/Icons";

export function BottomNav() {
  const p = usePathname();

  const Item = ({ href, label, Icon }: { href: string; label: string; Icon: any }) => {
    const active = p === href;
    return (
      <Link className={`navItem ${active ? "navItemActive" : ""}`} href={href}>
        <Icon />
        <div className={`navLabel ${active ? "navLabelActive" : ""}`}>{label}</div>
        <div className="navDot" />
      </Link>
    );
  };

  return (
    <div className="nav navFloat">
      <div className="navPill">
        <div className="navInner navInnerPremium">
          <Item href="/" label="Главная" Icon={IconHome} />
          <Item href="/spreads" label="Расклады" Icon={IconSpread} />
          <Item href="/deck" label="Колода" Icon={IconDeck} />
          <Item href="/archive" label="Архив" Icon={IconArchive} />
        </div>
      </div>
    </div>
  );
}
