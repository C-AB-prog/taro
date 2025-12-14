import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveCardImage, spreadPositions } from "@/lib/tarot";
import { ruTitleFromSlug } from "@/lib/ruTitles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function unauthorized() {
  const res = NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  res.cookies.set("session", "", { path: "/", maxAge: 0 });
  return res;
}

export async function GET() {
  const token = cookies().get("session")?.value;
  if (!token) return unauthorized();

  let session: { userId: string };
  try {
    session = await verifySession(token);
  } catch {
    return unauthorized();
  }

  const [spreads, wheels] = await Promise.all([
    prisma.spreadPurchase.findMany({
      where: { userId: session.userId },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { spread: true },
    }),
    prisma.wheelSpin.findMany({
      where: { userId: session.userId },
      orderBy: { date: "desc" },
      take: 100,
      include: { card: true },
    }),
  ]);

  const spreadItems = spreads.map((p) => {
    const slugs = (p.cardsJson as unknown as string[]) || [];
    const positions = spreadPositions(p.spread.key, slugs.length);
    return {
      kind: "spread" as const,
      id: p.id,
      ts: p.createdAt.toISOString(),
      title: p.spread.titleRu,
      paidAmount: p.paidAmount,
      positions,
      cards: slugs.map((slug) => ({
        slug,
        titleRu: ruTitleFromSlug(slug),
        image: resolveCardImage(slug),
      })),
      interpretation: p.interpretation,
    };
  });

  const wheelItems = wheels.map((w) => {
    const slug = w.card.slug;
    return {
      kind: "wheel" as const,
      id: w.id,
      ts: w.date.toISOString(),
      card: {
        slug,
        titleRu: w.card.titleRu || ruTitleFromSlug(slug),
        meaningRu: w.card.meaningRu || "",
        adviceRu: w.card.adviceRu || "",
        image: resolveCardImage(slug),
      },
    };
  });

  return NextResponse.json(
    { ok: true, items: [...spreadItems, ...wheelItems] },
    { headers: { "Cache-Control": "no-store" } }
  );
}
