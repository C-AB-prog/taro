import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/requireUser";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function noStoreJson(data: any, status = 200) {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: Request) {
  let userId = "";
  try {
    userId = await requireUserId(req);
  } catch {
    return noStoreJson({ ok: false, error: "UNAUTHORIZED" }, 401);
  }

  const body = await req.json().catch(() => ({}));
  const offerId = String(body?.offerId || "").trim();
  const openedFlag = Boolean(body?.opened); // можно слать true при клике "Открыть" (если хочешь)

  if (!offerId) return noStoreJson({ ok: false, error: "BAD_OFFER" }, 400);

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1) оффер существует и активен
      const offerRows = await tx.$queryRaw<Array<{ id: string; reward: number }>>`
        SELECT "id","reward"
        FROM "AdOffer"
        WHERE "id" = ${offerId} AND "active" = true
        LIMIT 1
      `;
      const offer = offerRows[0];
      if (!offer) return { status: 404 as const, json: { ok: false, error: "NOT_FOUND" } };

      // 2) open должен быть (или мы его зафиксируем если openedFlag=true)
      const openedRows = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT "id"
        FROM "AdOpen"
        WHERE "userId" = ${userId} AND "offerId" = ${offerId}
        LIMIT 1
      `;

      if (!openedRows[0]) {
        if (!openedFlag) {
          return { status: 400 as const, json: { ok: false, error: "OPEN_REQUIRED" } };
        }
        await tx.$executeRaw`
          INSERT INTO "AdOpen" ("userId","offerId")
          VALUES (${userId}, ${offerId})
          ON CONFLICT ("userId","offerId") DO NOTHING
        `;
      }

      // 3) claim один раз
      const inserted = await tx.$executeRaw`
        INSERT INTO "AdClaim" ("userId","offerId")
        VALUES (${userId}, ${offerId})
        ON CONFLICT ("userId","offerId") DO NOTHING
      `;

      if (Number(inserted) <= 0) {
        return { status: 400 as const, json: { ok: false, error: "ALREADY" } };
      }

      // 4) начисление
      const reward = Math.max(0, Number(offer.reward) || 0);

      await tx.user.update({
        where: { id: userId },
        data: { balance: { increment: reward } },
      });

      // 5) транзакция (не критично)
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

    return noStoreJson(result.json, result.status);
  } catch (e: any) {
    return noStoreJson(
      {
        ok: false,
        error: "CLAIM_FAIL",
        message: String(e?.message || e),
      },
      500
    );
  }
}
