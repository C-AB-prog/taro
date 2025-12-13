import { NextResponse } from "next/server";
import { getOrCreateDailyCard, resolveCardImage } from "@/lib/tarot";
import { generateCardReadingRu } from "@/lib/tarotReadings";
import { prisma } from "@/lib/prisma";

function needsGen(s: unknown) {
  const t = String(s ?? "").trim();
  if (!t) return true;
  if (t.length < 20) return true;
  if (t.includes("Эта карта говорит через образы")) return true;
  return false;
}

export async function GET() {
  const card: any = await getOrCreateDailyCard();

  let meaningRu = card.meaningRu;
  let adviceRu = card.adviceRu;

  if (needsGen(meaningRu) || needsGen(adviceRu)) {
    const gen = await generateCardReadingRu({
      titleRu: card.titleRu,
      kind: "daily",
    });

    meaningRu = gen.meaningRu;
    adviceRu = gen.adviceRu;

    // best-effort сохранение в БД
    try {
      const p: any = prisma;
      if (card?.id && typeof p.dailyCard?.update === "function") {
        await p.dailyCard.update({
          where: { id: card.id },
          data: { meaningRu, adviceRu },
        });
      }
    } catch {}
  }

  return NextResponse.json({
    card: {
      slug: card.slug,
      titleRu: card.titleRu,
      meaningRu,
      adviceRu,
      image: resolveCardImage(card.slug),
    },
  });
}
