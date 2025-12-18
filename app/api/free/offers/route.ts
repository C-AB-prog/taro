import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/requireUser";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type OfferRow = {
  id: string;
  title: string;
  url: string;
  reward: number;
};

function noStoreJson(data: any, status = 200) {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

export async function GET(req: Request) {
  let userId = "";
  try {
    userId = await requireUserId(req);
  } catch {
    return noStoreJson({ ok: false, error: "UNAUTHORIZED" }, 401);
  }

  try {
    // 1) offers
    // если вдруг в какой-то БД нет sort — упадёт, поэтому ловим и делаем fallback
    let offers: OfferRow[] = [];
    try {
      offers = await prisma.$queryRaw<OfferRow[]>`
        SELECT "id","title","url","reward"
        FROM "AdOffer"
        WHERE "active" = true
        ORDER BY "sort" DESC, "createdAt" DESC
      `;
    } catch {
      offers = await prisma.$queryRaw<OfferRow[]>`
        SELECT "id","title","url","reward"
        FROM "AdOffer"
        WHERE "active" = true
        ORDER BY "createdAt" DESC
      `;
    }

    // 2) opened
    const openedRows = await prisma.$queryRaw<Array<{ offerId: string }>>`
      SELECT "offerId" AS "offerId"
      FROM "AdOpen"
      WHERE "userId" = ${userId}
    `;
    const openedSet = new Set(openedRows.map((r) => r.offerId));

    // 3) claimed
    const claimedRows = await prisma.$queryRaw<Array<{ offerId: string }>>`
      SELECT "offerId" AS "offerId"
      FROM "AdClaim"
      WHERE "userId" = ${userId}
    `;
    const claimedSet = new Set(claimedRows.map((r) => r.offerId));

    return noStoreJson({
      ok: true,
      offers: offers.map((o) => ({
        id: o.id,
        title: o.title,
        url: o.url,
        reward: Number(o.reward) || 0,
        opened: openedSet.has(o.id),
        claimed: claimedSet.has(o.id),
      })),
    });
  } catch (e: any) {
    // чаще всего это “таблицы нет” или “колонки нет”
    return noStoreJson(
      {
        ok: false,
        error: "OFFERS_FAIL",
        message: String(e?.message || e),
      },
      500
    );
  }
}
