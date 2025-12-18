import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/requireUser";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  let userId: string | null = null;
  try {
    userId = await requireUserId(req);
  } catch {
    userId = null;
  }

  try {
    const offers = await prisma.$queryRaw<
      Array<{ id: string; title: string; url: string; reward: number }>
    >`
      SELECT "id","title","url","reward"
      FROM "AdOffer"
      WHERE "active" = true
      ORDER BY "sort" DESC, "createdAt" DESC
    `;

    let claimedSet = new Set<string>();
    if (userId) {
      const claimedRows = await prisma.$queryRaw<Array<{ offerId: string }>>`
        SELECT "offerId" AS "offerId"
        FROM "AdClaim"
        WHERE "userId" = ${userId}
      `;
      claimedSet = new Set(claimedRows.map((r) => r.offerId));
    }

    return NextResponse.json(
      {
        ok: true,
        offers: offers.map((o) => ({
          id: o.id,
          title: o.title,
          url: o.url,
          reward: Number(o.reward) || 0,
          claimed: userId ? claimedSet.has(o.id) : false,
        })),
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (e: any) {
    return NextResponse.json(
      {
        ok: false,
        error: "AD_OFFER_QUERY_FAIL",
        message: String(e?.message || e),
      },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
