import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySession } from "@/lib/auth";
import { spinWheel, resolveCardImage } from "@/lib/tarot";
import { generateCardReadingRu } from "@/lib/tarotReadings";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function needsGen(s: unknown) {
  const t = String(s ?? "").trim();
  if (!t) return true;

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
  if (t.length < 60) return true;
  return false;
}

export async function POST() {
  const token = cookies().get("session")?.value;
  if (!token) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const session = await verifySession(token);
  const result: any = await spinWheel(session.userId);

  const card: any = result.card;

  let meaningRu = card.meaningRu;
  let adviceRu = card.adviceRu;

  if (needsGen(meaningRu) || needsGen(adviceRu)) {
    const gen = await generateCardReadingRu({
      titleRu: card.titleRu,
      kind: "wheel",
    });

    meaningRu = gen.meaningRu;
    adviceRu = gen.adviceRu;

    // best-effort сохранение (если у тебя есть wheelSpin модель/запись)
    try {
      const p: any = prisma;

      // иногда result может содержать id записи спина
      const spinId = result?.spin?.id ?? result?.spinId ?? card?.spinId ?? null;

      if (spinId && p.wheelSpin?.update) {
        await p.wheelSpin.update({
          where: { id: spinId },
          data: { meaningRu, adviceRu },
        });
      } else if (card?.id && p.wheelSpin?.update) {
        // на случай если card.id = id спина (как было у тебя раньше)
        await p.wheelSpin.update({
          where: { id: card.id },
          data: { meaningRu, adviceRu },
        });
      }
    } catch {}
  }

  return NextResponse.json({
    already: result.already,
    card: {
      slug: card.slug,
      titleRu: card.titleRu,
      meaningRu,
      adviceRu,
      image: resolveCardImage(card.slug),
    },
  });
}
