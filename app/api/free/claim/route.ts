import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/requireUser";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const userId = await requireUserId(req);
  const body = await req.json().catch(() => ({}));

  const offerId = String(body?.offerId || "").trim();
  const openedFlag = Boolean(body?.opened); // true можно слать при клике "Открыть"

  if (!offerId) return NextResponse.json({ ok: false, error: "BAD_OFFER" }, { status: 400 });

  try {
    const result = await prisma.$transaction(async (tx) => {
      const offerRows = await tx.$queryRaw<Array<{ id: string; reward: number }>>`
        SELECT "id","reward"
        FROM "AdOffer"
        WHERE "id" = ${offerId} AND "active" = true
        LIMIT 1
      `;
      const offer = offerRows[0];
      if (!offer) return { status: 404 as const, json: { ok: false, error: "NOT_FOUND" } };

      // Проверяем open
      const openRows = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT "id"
        FROM "AdOpen"
        WHERE "userId" = ${userId} AND "offerId" = ${offerId}
        LIMIT 1
      `;

      if (!openRows[0]) {
        if (!openedFlag) {
          return { status: 400 as const, json: { ok: false, error: "OPEN_REQUIRED" } };
        }
        // Если пришло opened:true — фиксируем open прямо тут
        await tx.$executeRaw`
          INSERT INTO "AdOpen" ("userId","offerId")
          VALUES (${userId}, ${offerId})
          ON CONFLICT ("userId","offerId") DO NOTHING
        `;
      }

      // Claim один раз
      const inserted = await tx.$executeRaw`
        INSERT INTO "AdClaim" ("userId","offerId")
        VALUES (${userId}, ${offerId})
        ON CONFLICT ("userId","offerId") DO NOTHING
      `;
      if (Number(inserted) <= 0) {
        return { status: 400 as const, json: { ok: false, error: "ALREADY" } };
      }

      const reward = Number(offer.reward) || 0;

      await tx.user.update({
        where: { id: userId },
        data: { balance: { increment: reward } },
      });

      try {
        await tx.transaction.create({
          data: {
            userId,
            type: "grant",
            amount: reward,
            provider: "system",
            providerPayload: { kind: "ad", offerId },
          } as any,
        });
      } catch {}

      return { status: 200 as const, json: { ok: true, reward } };
    });

    return NextResponse.json(result.json, {
      status: result.status,
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json({ ok: false, error: "FAIL" }, { status: 500 });
  }
}
