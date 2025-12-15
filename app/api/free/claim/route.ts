import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/requireUser";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function ensureOffersTables() {
  try {
    await prisma.$executeRawUnsafe(`CREATE EXTENSION IF NOT EXISTS pgcrypto;`);
  } catch {}

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
    CREATE INDEX IF NOT EXISTS "AdClaim_userId_idx" ON "AdClaim" ("userId");
  `);
}

export async function POST(req: Request) {
  let userId = "";
  try {
    userId = await requireUserId(req);
  } catch {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  await ensureOffersTables();

  const body = await req.json().catch(() => ({}));
  const offerId = String(body?.offerId || "").trim();
  if (!offerId) return NextResponse.json({ ok: false, error: "BAD_REQUEST" }, { status: 400 });

  const rows = await prisma.$queryRaw<Array<{ reward: number }>>`
    SELECT "reward"
    FROM "AdOffer"
    WHERE "id" = ${offerId} AND "active" = true
    LIMIT 1
  `;
  const offer = rows[0];
  if (!offer) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });

  const inserted = await prisma.$executeRaw`
    INSERT INTO "AdClaim" ("userId","offerId")
    VALUES (${userId}, ${offerId})
    ON CONFLICT ("userId","offerId") DO NOTHING
  `;

  if (Number(inserted) <= 0) {
    return NextResponse.json({ ok: false, error: "ALREADY" }, { status: 200, headers: { "Cache-Control": "no-store" } });
  }

  await prisma.user.update({
    where: { id: userId },
    data: { balance: { increment: Number(offer.reward) } },
  });

  return NextResponse.json({ ok: true, reward: Number(offer.reward) }, { headers: { "Cache-Control": "no-store" } });
}
