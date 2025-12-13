import { NextResponse } from "next/server";
import { getOrCreateDailyCard, resolveCardImage } from "@/lib/tarot";
import { generateCardReadingRu } from "@/lib/tarotReadings";
import { prisma } from "@/lib/prisma";
import { ruTitleFromSlug } from "@/lib/ruTitles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function needsGen(s: unknown) {
  const t = String(s ?? "").trim();
  if (!t) return true;

  const bad =
    t.includes("Сделай один небольшой шаг") ||
    t.includes("Сделай паузу, выдохни") ||
    t.includes("знак дня: многое проясняется") ||
    t.includes("тонкий знак: сейчас важно") ||
    t.includes("Выбери один практичный шаг");

  if (bad) return true;
  if (t.length < 60) return true;
  return false;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const force = url.searchParams.get("force") === "1";

  const card: any = await getOrCreateDailyCard();

  // ✅ всегда используем русское имя по slug (а не то, что лежит в БД)
  const titleRu = ruTitleFromSlug(card.slug) || String(card.titleRu ?? "");

  let meaningRu = card.meaningRu;
  let adviceRu = card.adviceRu;

  let aiSource: "ai" | "fallback" | "stored" = "stored";

  if (force || needsGen(meaningRu) || needsGen(adviceRu)) {
    const gen = await generateCardReadingRu({
      titleRu,
      kind: "daily",
    });

    meaningRu = gen.meaningRu;
    adviceRu = gen.adviceRu;
    aiSource = gen._source;

    // best-effort сохранение
    try {
      const p: any = prisma;
      if (card?.id && p.dailyCard?.update) {
        await p.dailyCard.update({
          where: { id: card.id },
          data: { titleRu, meaningRu, adviceRu },
        });
      }
    } catch {}
  }

  return NextResponse.json(
    {
      card: {
        slug: card.slug,
        titleRu,
        meaningRu,
        adviceRu,
        image: resolveCardImage(card.slug),
      },
      aiSource,
      model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
      forced: force,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
