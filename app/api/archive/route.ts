import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { resolveCardImage } from "@/lib/tarot";

export async function GET() {
  const token = cookies().get("session")?.value;
  if (!token) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const session = await verifySession(token);

  const wheel = await prisma.wheelSpin.findMany({
    where: { userId: session.userId },
    orderBy: { date: "desc" },
    include: { card: true },
    take: 100,
  });

  const spreads = await prisma.spreadPurchase.findMany({
    where: { userId: session.userId },
    orderBy: { createdAt: "desc" },
    include: { spread: true },
    take: 100,
  });

  return NextResponse.json({
    wheel: wheel.map(w => ({
      date: w.date,
      card: {
        slug: w.card.slug,
        titleRu: w.card.titleRu,
        meaningRu: w.card.meaningRu,
        adviceRu: w.card.adviceRu,
        image: resolveCardImage(w.card.slug),
      }
    })),
    spreads: spreads.map(s => ({
      createdAt: s.createdAt,
      spreadTitle: s.spread.titleRu,
      paidAmount: s.paidAmount,
      cards: (s.cardsJson as any[]).map((slug) => ({ slug, image: resolveCardImage(String(slug)) })),
      interpretation: s.interpretation,
    })),
  });
}
