import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/requireUser";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const userId = await requireUserId(req);
  const body = await req.json().catch(() => ({}));
  const offerId = String(body?.offerId || "").trim();
  if (!offerId) return NextResponse.json({ ok: false, error: "BAD_OFFER" }, { status: 400 });

  const offerRows = await prisma.$queryRaw<Array<{ id: string; reward: number }>>`
    SELECT "id","reward" FROM "AdOffer" WHERE "id" = ${offerId} AND "active" = true LIMIT 1
  `;
  const offer = offerRows[0];
  if (!offer) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });

  // требуем open
  const opened = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT "id" FROM "AdOpen" WHERE "userId" = ${userId} AND "offerId" = ${offerId} LIMIT 1
  `;
  if (!opened[0]) return NextResponse.json({ ok: false, error: "OPEN_REQUIRED" }, { status: 400 });

  // атомарно: claim один раз + начисление
  try {
    const inserted = await prisma.$executeRaw`
      INSERT INTO "AdClaim" ("userId","offerId")
      VALUES (${userId}, ${offerId})
      ON CONFLICT ("userId","offerId") DO NOTHING
    `;
    if (Number(inserted) <= 0) {
      return NextResponse.json({ ok: false, error: "ALREADY" }, { status: 400 });
    }

    const reward = Number(offer.reward) || 0;

    await prisma.user.update({
      where: { id: userId },
      data: { balance: { increment: reward } },
    });

    // транзакция (если у тебя используется)
    try {
      await prisma.transaction.create({
        data: {
          userId,
          type: "grant",
          amount: reward,
          provider: "system",
          providerPayload: { kind: "ad", offerId },
        } as any,
      });
    } catch {}

    return NextResponse.json({ ok: true, reward }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ ok: false, error: "FAIL" }, { status: 500 });
  }
}
