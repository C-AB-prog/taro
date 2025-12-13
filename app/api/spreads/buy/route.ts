import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySession } from "@/lib/auth";
import { buySpread, resolveCardImage, spreadPositions } from "@/lib/tarot";
import { ruTitleFromSlug } from "@/lib/ruTitles";
import { generateSpreadReadingRu } from "@/lib/tarotReadings";
import { prisma } from "@/lib/prisma";

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
  const token = cookies().get("session")?.value;
  if (!token) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const { spreadKey } = await req.json();
  const session = await verifySession(token);

  try {
    const purchase: any = await buySpread(session.userId, spreadKey);

    const slugs = purchase.cardsJson as unknown as string[];
    const positions = spreadPositions(spreadKey, slugs.length);

    const spreadTitle = purchase.spread.titleRu;
    const tag = guessTagByTitle(spreadTitle);

    // ✅ русские названия карт идут в ИИ
    const cardTitlesRu = slugs.map((slug) => ruTitleFromSlug(slug));

    // ✅ генерим не-шаблонную трактовку
    const gen = await generateSpreadReadingRu({
      spreadTitle,
      positions,
      cardTitlesRu,
      tag,
    });

    // важно: чтобы UI корректно выделял совет
    const interpretation = `${gen.interpretationRu}\n\nСовет: ${gen.adviceRu}`;

    // ✅ сохраняем в покупку (неизменно для архива)
    try {
      const p: any = prisma;
      if (purchase?.id && p.spreadPurchase?.update) {
        await p.spreadPurchase.update({
          where: { id: purchase.id },
          data: { interpretation },
        });
      }
    } catch {}

    const view = {
      spreadTitle,
      paidAmount: purchase.paidAmount,
      positions,
      cards: slugs.map((slug) => ({ slug, image: resolveCardImage(slug) })),
      interpretation,
    };

    return NextResponse.json({ ok: true, view });
  } catch (e: any) {
    if (e?.message === "NOT_ENOUGH_BALANCE") {
      return NextResponse.json({ error: "NOT_ENOUGH_BALANCE" }, { status: 402 });
    }
    return NextResponse.json({ error: "BUY_FAILED" }, { status: 400 });
  }
}
