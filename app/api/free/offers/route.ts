import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/requireUser";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const userId = await requireUserId(req);

  const offers = await prisma.$queryRaw<
    Array<{ id: string; title: string; url: string; reward: number }>
  >`
    SELECT "id","title","url","reward"
    FROM "AdOffer"
    WHERE "active" = true
    ORDER BY "sort" DESC, "createdAt" DESC
  `;

  const claimedRows = await prisma.$queryRaw<Array<{ offerId: string }>>`
    SELECT "offerId" AS "offerId"
    FROM "AdClaim"
    WHERE "userId" = ${userId}
  `;

  const claimedSet = new Set(claimedRows.map((r) => r.offerId));

  return NextResponse.json(
    {
      ok: true,
      offers: offers.map((o) => ({
        id: o.id,
        title: o.title,
        url: o.url,
        reward: Number(o.reward) || 0,
        claimed: claimedSet.has(o.id),
      })),
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
