import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function ensureTables() {
  // чтобы gen_random_uuid() работал на любой базе
  try {
    await prisma.$executeRawUnsafe(`CREATE EXTENSION IF NOT EXISTS pgcrypto;`);
  } catch {}

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "AdvertiserChannel" (
      "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      "url" TEXT NOT NULL UNIQUE,
      "username" TEXT,
      "title" TEXT NOT NULL,
      "photoFileId" TEXT,
      "reward" INTEGER NOT NULL DEFAULT 100,
      "active" BOOLEAN NOT NULL DEFAULT true,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "AdvertiserClaim" (
      "userId" TEXT NOT NULL,
      "channelId" TEXT NOT NULL,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY ("userId","channelId")
    );
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "AdvertiserChannel_active_idx"
    ON "AdvertiserChannel" ("active");
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "AdvertiserClaim_userId_idx"
    ON "AdvertiserClaim" ("userId");
  `);
}

export async function GET() {
  const token = cookies().get("session")?.value;
  if (!token) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });

  let session: { userId: string };
  try {
    session = await verifySession(token);
  } catch {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  await ensureTables();

  const rows = await prisma.$queryRaw<
    Array<{
      id: string;
      url: string;
      title: string;
      photoFileId: string | null;
      reward: number;
      claimed: boolean;
    }>
  >`
    SELECT
      c."id",
      c."url",
      c."title",
      c."photoFileId",
      c."reward",
      (cl."userId" IS NOT NULL) AS "claimed"
    FROM "AdvertiserChannel" c
    LEFT JOIN "AdvertiserClaim" cl
      ON cl."userId" = ${session.userId}
     AND cl."channelId" = c."id"
    WHERE c."active" = true
    ORDER BY c."createdAt" DESC
    LIMIT 50
  `;

  return NextResponse.json(
    { ok: true, offers: rows },
    { headers: { "Cache-Control": "no-store" } }
  );
}
