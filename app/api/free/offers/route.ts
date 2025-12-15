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
    CREATE INDEX IF NOT EXISTS "AdOffer_active_idx" ON "AdOffer" ("active");
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "AdClaim_userId_idx" ON "AdClaim" ("userId");
  `);
}

export async function GET(req: Request) {
  await ensureOffersTables();

  // если нет авторизации (например открылось вне TG) — просто claimed=false
  let userId = "__none__";
  try {
    userId = await requireUserId(req);
  } catch {}

  const offers = await prisma.$queryRaw<
    Array<{ id: string; title: string; url: string; reward: number; claimed: boolean }>
  >`
    SELECT
      o."id",
      o."title",
      o."url",
      o."reward",
      (c."userId" IS NOT NULL) AS claimed
    FROM "AdOffer" o
    LEFT JOIN "AdClaim" c
      ON c."offerId" = o."id" AND c."userId" = ${userId}
    WHERE o."active" = true
    ORDER BY o."createdAt" DESC
    LIMIT 50
  `;

  return NextResponse.json({ ok: true, offers }, { headers: { "Cache-Control": "no-store" } });
}
