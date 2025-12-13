import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySession } from "@/lib/auth";
import { spinWheel, resolveCardImage } from "@/lib/tarot";
import { generateCardReadingRu } from "@/lib/tarotReadings";
import { prisma } from "@/lib/prisma";

function needsGen(s: unknown) {
  const t = String(s ?? "").trim();
  if (!t) return true;
  if (t.length < 20) return true;
  if (t.includes("Эта карта говорит через образы")) return true;
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

    // best-effort сохранение в БД (если модель называется wheelSpin)
    try {
      const p: any = prisma;
      if (card?.id && typeof p.wheelSpin?.update === "function") {
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
