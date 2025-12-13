import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { ensureBootstrapped } from "@/lib/bootstrap";
import { generateCardTexts } from "@/lib/ai";
import { resolveCardImage } from "@/lib/tarot";

export async function GET(_: Request, { params }: { params: { slug: string } }) {
  await ensureBootstrapped();

  const card = await prisma.card.findUnique({ where: { slug: params.slug } });
  if (!card) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });

  let updated = card;
  if (!card.meaningRu || !card.adviceRu || !card.titleRu) {
    const t = await generateCardTexts(card.slug);
    updated = await prisma.card.update({
      where: { slug: card.slug },
      data: { titleRu: t.titleRu, meaningRu: t.meaningRu, adviceRu: t.adviceRu },
    });
  }

  return NextResponse.json({
    card: {
      slug: updated.slug,
      titleRu: updated.titleRu,
      meaningRu: updated.meaningRu,
      image: resolveCardImage(updated.slug),
    },
  });
}
