import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function unauthorized() {
  const res = NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  // на всякий случай сбросим cookie
  res.cookies.set("session", "", { path: "/", maxAge: 0 });
  return res;
}

async function ensureOffersTables() {
  // каналы/офферы
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "AdOffer" (
      "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      "title" TEXT NOT NULL,
      "url" TEXT NOT NULL UNIQUE,
      "reward" INTEGER NOT NULL DEFAULT 100,
      "active" BOOLEAN NOT NULL DEFAULT true,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  // кто уже забрал бонус (идемпотентность)
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "AdClaim" (
      "userId" TEXT NOT NULL,
      "offerId" TEXT NOT NULL,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY ("userId","offerId")
    );
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "AdOffer_active_idx" ON "AdOffer" ("active");
  `);
}

export async function POST(req: Request) {
  const token = cookies().get("session")?.value;
  if (!token) return unauthorized();

  let session: { userId: string };
  try {
    session = await verifySession(token);
  } catch {
    return unauthorized();
  }

  const body = await req.json().catch(() => ({}));
  const offerId = String(body?.offerId || "").trim();
  if (!offerId) {
    return NextResponse.json({ ok: false, error: "BAD_REQUEST" }, { status: 400 });
  }

  await ensureOffersTables();

  try {
    const out = await prisma.$transaction(async (tx) => {
      // 1) оффер должен существовать и быть активным
      const rows = await tx.$queryRaw<
        Array<{ id: string; reward: number; active: boolean }>
      >`
        SELECT "id","reward","active"
        FROM "AdOffer"
        WHERE "id" = ${offerId} AND "active" = true
        LIMIT 1
      `;

      if (!rows.length) {
        const err: any = new Error("NOT_FOUND");
        err.code = "NOT_FOUND";
        throw err;
      }

      const reward = Number(rows[0].reward || 0);
      if (!Number.isFinite(reward) || reward <= 0 || reward > 1000000) {
        const err: any = new Error("BAD_REWARD");
        err.code = "BAD_REWARD";
        throw err;
      }

      // 2) пытаемся поставить метку "забрал"
      // если уже было — inserted будет 0
      const inserted = await tx.$executeRaw`
        INSERT INTO "AdClaim" ("userId","offerId")
        VALUES (${session.userId}, ${offerId})
        ON CONFLICT ("userId","offerId") DO NOTHING
      `;

      if (Number(inserted) === 0) {
        const err: any = new Error("ALREADY_CLAIMED");
        err.code = "ALREADY_CLAIMED";
        throw err;
      }

      // 3) начисляем баланс
      const user = await tx.user.update({
        where: { id: session.userId },
        data: { balance: { increment: reward } },
        select: { balance: true },
      });

      // 4) лог транзакции (не обязательно, но полезно)
      await tx.transaction.create({
        data: {
          userId: session.userId,
          type: "grant",
          amount: reward,
          provider: "system",
          providerPayload: { kind: "ad_offer", offerId },
        },
      });

      return { reward, balance: user.balance };
    });

    return NextResponse.json(
      { ok: true, reward: out.reward, balance: out.balance },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (e: any) {
    const code = e?.code || e?.message;

    if (code === "ALREADY_CLAIMED") {
      return NextResponse.json({ ok: false, error: "ALREADY_CLAIMED" }, { status: 409 });
    }
    if (code === "NOT_FOUND") {
      return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
    }
    if (code === "BAD_REWARD") {
      return NextResponse.json({ ok: false, error: "BAD_REWARD" }, { status: 400 });
    }

    // не показываем юзеру “код” и внутренности
    return NextResponse.json({ ok: false, error: "CLAIM_FAILED" }, { status: 400 });
  }
}
