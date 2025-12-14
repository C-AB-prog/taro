import { NextResponse } from "next/server";
import { buySpread, resolveCardImage, spreadPositions } from "@/lib/tarot";
import { ruTitleFromSlug } from "@/lib/ruTitles";
import { generateSpreadReadingRu } from "@/lib/tarotReadings";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/requireUser";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function guessTagByTitle(titleRu: string): "general" | "love" | "money" | "health" {
  const t = (titleRu || "").toLowerCase();
  if (t.includes("здоров") || t.includes("айболит")) return "health";
  if (t.includes("ден") || t.includes("деньг") || t.includes("финанс")) return "money";
  if (t.includes("двоих") || t.includes("отнош") || t.includes("пары")) return "love";
  return "general";
}

export async function POST(req: Request) {
  let userId = "";
  try {
    userId = await requireUserId(req);
  } catch {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const { spreadKey } = await req.json().catch(() => ({}));
  if (!spreadKey) return NextResponse.json({ error: "BAD_REQUEST" }, { status: 400 });

  try {
    const purchase: any = await buySpread(userId, spreadKey);

    const slugs = purchase.cardsJson as unknown as string[];
    const positions = spreadPositions(spreadKey, slugs.length);

    const spreadTitle = purchase.spread.titleRu;
    const tag = guessTagByTitle(spreadTitle);
    const cardTitlesRu = slugs.map((slug) => ruTitleFromSlug(slug));

    let interpretation: string = purchase.interpretation || "";
    try {
      const gen = await generateSpreadReadingRu({
        spreadTitle,
        positions,
        cardTitlesRu,
        tag,
      });

      interpretation = `${gen.interpretationRu}\n\nСовет: ${gen.adviceRu}`;

      await prisma.spreadPurchase.update({
        where: { id: purchase.id },
        data: { interpretation },
      });
    } catch {
      // если ИИ временно упал — не ломаем покупку
    }

    const view = {
      spreadTitle,
      paidAmount: purchase.paidAmount,
      positions,
      cards: slugs.map((slug) => ({ slug, image: resolveCardImage(slug) })),
      interpretation,
    };

    return NextResponse.json({ ok: true, view }, { headers: { "Cache-Control": "no-store" } });
  } catch (e: any) {
    if (e?.message === "NOT_ENOUGH_BALANCE") {
      return NextResponse.json({ error: "NOT_ENOUGH_BALANCE" }, { status: 402 });
    }
    return NextResponse.json({ error: "BUY_FAILED" }, { status: 400 });
  }
}
