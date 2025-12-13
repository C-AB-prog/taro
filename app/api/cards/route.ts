import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ensureBootstrapped } from "@/lib/bootstrap";
import { resolveCardImage } from "@/lib/tarot";

export async function GET() {
  await ensureBootstrapped();
  const cards = await prisma.card.findMany({ orderBy: { slug: "asc" } });

  return NextResponse.json({
    cards: cards.map((c) => ({
      slug: c.slug,
      titleRu: c.titleRu || c.slug.replace(/-unified$/,"").replace(/-/g, " "),
      image: resolveCardImage(c.slug),
    })),
  });
}
