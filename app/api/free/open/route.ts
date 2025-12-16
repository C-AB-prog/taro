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

  // ✅ фиксируем факт нажатия "Открыть"
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

  // offer должен быть активный
  const rows = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT "id" FROM "AdOffer" WHERE "id" = ${offerId} AND "active" = true LIMIT 1
  `;
  if (!rows[0]) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });

  // idempotent: фиксируем open (или обновляем время)
  await prisma.$executeRaw`
    INSERT INTO "AdOpen" ("userId","offerId")
    VALUES (${userId}, ${offerId})
    ON CONFLICT ("userId","offerId")
    DO UPDATE SET "openedAt" = now()
  `;

  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
