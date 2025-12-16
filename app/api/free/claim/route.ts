import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/requireUser";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function ensureAdsTables() {
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

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "AdClaim" (
      "userId" TEXT NOT NULL,
      "offerId" TEXT NOT NULL,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY ("userId","offerId")
    );
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "AdOpen" (
      "userId" TEXT NOT NULL,
      "offerId" TEXT NOT NULL,
      "openedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY ("userId","offerId")
    );
  `);
}

export async function POST(req: Request) {
  let userId = "";
  try {
    userId = await requireUserId(req);
  } catch {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  await ensureAdsTables();

  const body = await req.json().catch(() => ({}));
  const offerId = String(body?.offerId || "").trim();
  if (!offerId) return NextResponse.json({ ok: false, error: "BAD_REQUEST" }, { status: 400 });

  const offerRows = await prisma.$queryRaw<Array<{ reward: number }>>`
    SELECT "reward"
    FROM "AdOffer"
    WHERE "id" = ${offerId} AND "active" = true
    LIMIT 1
  `;
  const offer = offerRows[0];
  if (!offer) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });

  // ✅ ТРЕБУЕМ, чтобы пользователь нажал "Открыть"
  const openRows = await prisma.$queryRaw<Array<{ openedAt: Date }>>`
    SELECT "openedAt"
    FROM "AdOpen"
    WHERE "userId" = ${userId} AND "offerId" = ${offerId}
    LIMIT 1
  `;
  if (!openRows[0]) {
    return NextResponse.json(
      { ok: false, error: "OPEN_REQUIRED" },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  }

  // идемпотентно: один раз на оффер
  const inserted = await prisma.$executeRaw`
    INSERT INTO "AdClaim" ("userId","offerId")
    VALUES (${userId}, ${offerId})
    ON CONFLICT ("userId","offerId") DO NOTHING
  `;

  if (Number(inserted) <= 0) {
    return NextResponse.json(
      { ok: false, error: "ALREADY" },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  }

  await prisma.user.update({
    where: { id: userId },
    data: { balance: { increment: Number(offer.reward) } },
  });

  return NextResponse.json(
    { ok: true, reward: Number(offer.reward) },
    { headers: { "Cache-Control": "no-store" } }
  );
}
