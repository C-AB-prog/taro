import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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
}

export async function GET() {
  await ensureOffersTables();

  // если есть сессия — подсветим claimed
  let userId = "__none__";
  const token = cookies().get("session")?.value;
  if (token) {
    try {
      const s = await verifySession(token);
      userId = s.userId;
    } catch {}
  }

  const offers = await prisma.$queryRaw<
    Array<{ id: string; title: string; url: string; reward: number; claimed: boolean }>
  >`
    SELECT
      o."id", o."title", o."url", o."reward",
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
