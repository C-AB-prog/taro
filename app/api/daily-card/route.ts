import { NextResponse } from "next/server";
import { getOrCreateDailyCard, resolveCardImage } from "@/lib/tarot";
import { generateCardReadingRu } from "@/lib/tarotReadings";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function needsGen(s: unknown) {
  const t = String(s ?? "").trim();
  if (!t) return true;

  // наши частые fallback-фразы (если они есть — значит не ИИ или старьё в БД)
  const bad =
    t.includes("Сделай один небольшой шаг") ||
    t.includes("Сделай паузу, выдохни") ||
    t.includes("Выбери один практичный шаг") ||
    t.includes("Не торопи события: сделай один спокойный шаг") ||
    t.includes("тонкий знак: сейчас важно") ||
    t.includes("знак дня: многое проясняется") ||
    t.includes("собери мысли и выбери") ||
    t.includes("постепенно") ||
    t.includes("внутреннее равновесие");

  if (bad) return true;

  // слишком короткое — чаще всего заглушка
  if (t.length < 60) return true;

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

    // best-effort: сохраним в БД, чтобы дальше было стабильно
    try {
      const p: any = prisma;

      // если модель называется dailyCard
      if (card?.id && p.dailyCard?.update) {
        await p.dailyCard.update({
          where: { id: card.id },
          data: { meaningRu, adviceRu },
        });
      } else if (card?.slug && p.dailyCard?.updateMany) {
        await p.dailyCard.updateMany({
          where: { slug: card.slug },
          data: { meaningRu, adviceRu },
        });
      }

      // если у тебя модель называется иначе — просто не упадём
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
