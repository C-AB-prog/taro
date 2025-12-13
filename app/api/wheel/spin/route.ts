import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySession } from "@/lib/auth";
import { spinWheel, resolveCardImage } from "@/lib/tarot";
import { generateCardReadingRu } from "@/lib/tarotReadings";
import { prisma } from "@/lib/prisma";
import { ruTitleFromSlug } from "@/lib/ruTitles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function unauthorized() {
  const res = NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  res.cookies.set("session", "", { path: "/", maxAge: 0 });
  return res;
}

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
  if (!token) return unauthorized();

  let session: any;
  try {
    session = await verifySession(token);
  } catch {
    return unauthorized();
  }

  let result: any;
  try {
    result = await spinWheel(session.userId);
  } catch {
    // если по какой-то причине юзера нет/ошибка БД — пусть будет 401 (чтобы перезалогиниться)
    return unauthorized();
  }

  const card: any = result.card;
  const titleRu = ruTitleFromSlug(card.slug) || String(card.titleRu ?? "");

  let meaningRu = card.meaningRu;
  let adviceRu = card.adviceRu;
  let aiSource: "ai" | "fallback" | "stored" = "stored";

  if (force || needsGen(meaningRu) || needsGen(adviceRu)) {
    const gen = await generateCardReadingRu({ titleRu, kind: "wheel" });
    meaningRu = gen.meaningRu;
    adviceRu = gen.adviceRu;
    aiSource = gen._source;

    // best-effort сохранить в WheelSpin, если есть id спина
    try {
      const spinId = result?.spin?.id ?? result?.spinId ?? null;
      if (spinId) {
        await prisma.wheelSpin.update({
          where: { id: spinId },
          data: { /* тут нет полей meaning/advice в таблице WheelSpin, они в Card */
          },
        }).catch(() => {});
      }
      // Тексты у тебя хранятся в Card, поэтому лучше обновить Card:
      if (card?.id) {
        await prisma.card.update({
          where: { id: card.id },
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
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
