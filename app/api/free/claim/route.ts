import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function unauthorized() {
  const res = NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  res.cookies.set("session", "", { path: "/", maxAge: 0 });
  return res;
}

async function ensureTables() {
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
    CREATE INDEX IF NOT EXISTS "AdvertiserClaim_userId_idx"
    ON "AdvertiserClaim" ("userId");
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

  await ensureTables();

  const body = await req.json().catch(() => ({}));
  const offerId = String(body?.offerId || "").trim();
  if (!offerId) return NextResponse.json({ ok: false, error: "BAD_REQUEST" }, { status: 400 });

  const rows = await prisma.$queryRaw<
    Array<{ reward: number }>
  >`
    SELECT "reward"
    FROM "AdvertiserChannel"
    WHERE "id" = ${offerId} AND "active" = true
    LIMIT 1
  `;

  const offer = rows[0];
  if (!offer) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });

  // 1 раз на канал (идемпотентно)
  const inserted = await prisma.$executeRaw`
    INSERT INTO "AdvertiserClaim" ("userId","channelId")
    VALUES (${session.userId}, ${offerId})
    ON CONFLICT ("userId","channelId") DO NOTHING
  `;

  if (Number(inserted) <= 0) {
    // уже забирал
    return NextResponse.json(
      { ok: false, error: "ALREADY" },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  }

  await prisma.user.update({
    where: { id: session.userId },
    data: { balance: { increment: Number(offer.reward) } },
  });

  return NextResponse.json(
    { ok: true, reward: Number(offer.reward) },
    { headers: { "Cache-Control": "no-store" } }
  );
}
