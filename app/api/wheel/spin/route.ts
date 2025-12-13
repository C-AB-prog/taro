import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySession } from "@/lib/auth";
import { spinWheel, resolveCardImage } from "@/lib/tarot";
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

export async function POST(req: Request) {
  const url = new URL(req.url);
  const force = url.searchParams.get("force") === "1";

  const token = cookies().get("session")?.value;
  if (!token) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const session = await verifySession(token);
  const result: any = await spinWheel(session.userId);

  const card: any = result.card;

  // ✅ русское имя всегда по slug
  const titleRu = ruTitleFromSlug(card.slug) || String(card.titleRu ?? "");

  let meaningRu = card.meaningRu;
  let adviceRu = card.adviceRu;

  let aiSource: "ai" | "fallback" | "stored" = "stored";

  // даже если already=true — мы всё равно можем перегенерить тексты (для теста/починки)
  if (force || needsGen(meaningRu) || needsGen(adviceRu)) {
    const gen = await generateCardReadingRu({
      titleRu,
      kind: "wheel",
    });

    meaningRu = gen.meaningRu;
    adviceRu = gen.adviceRu;
    aiSource = gen._source;

    // best-effort сохранение (если у тебя есть wheelSpin таблица)
    try {
      const p: any = prisma;
      const spinId = result?.spin?.id ?? result?.spinId ?? null;
      if (spinId && p.wheelSpin?.update) {
        await p.wheelSpin.update({
          where: { id: spinId },
          data: { titleRu, meaningRu, adviceRu },
        });
      }
    } catch {}
  }

  return NextResponse.json(
    {
      already: result.already,
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
