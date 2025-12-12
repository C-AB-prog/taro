import { NextResponse } from "next/server";
import { getOrCreateDailyCard, resolveCardImage } from "@/lib/tarot";

export async function GET() {
  const card = await getOrCreateDailyCard();
  return NextResponse.json({
    card: {
      slug: card.slug,
      titleRu: card.titleRu,
      meaningRu: card.meaningRu,
      adviceRu: card.adviceRu,
      image: resolveCardImage(card.slug),
    },
  });
}
