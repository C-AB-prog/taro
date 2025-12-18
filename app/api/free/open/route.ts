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

      // фиксируем факт "Открыть" (идемпотентно)
      await tx.$executeRaw`
        INSERT INTO "AdOpen" ("userId","offerId")
        VALUES (${userId}, ${offerId})
        ON CONFLICT ("userId","offerId") DO NOTHING
      `;

      // пытаемся выдать награду один раз
      const inserted = await tx.$executeRaw`
        INSERT INTO "AdClaim" ("userId","offerId")
        VALUES (${userId}, ${offerId})
        ON CONFLICT ("userId","offerId") DO NOTHING
      `;

      if (Number(inserted) <= 0) {
        return { status: 200 as const, json: { ok: true, claimed: true, reward: 0 } };
      }

      const reward = Math.max(0, Number(offer.reward) || 0);

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

      return { status: 200 as const, json: { ok: true, claimed: true, reward } };
    });

    return NextResponse.json(result.json, {
      status: result.status,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: "OPEN_CLAIM_FAIL", message: String(e?.message || e) },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
