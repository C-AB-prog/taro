import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function ensureBotTables() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "AdvertiserChannel" (
      "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      "url" TEXT NOT NULL UNIQUE,
      "username" TEXT,
      "title" TEXT NOT NULL,
      "photoFileId" TEXT,
      "reward" INTEGER NOT NULL DEFAULT 100,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
}

export async function GET() {
  await ensureBotTables();

  const rows = await prisma.$queryRawUnsafe<any[]>(
    `SELECT "id","url","title","photoFileId","reward"
     FROM "AdvertiserChannel"
     ORDER BY "createdAt" DESC
     LIMIT 50`
  );

  return NextResponse.json({ ok: true, items: rows }, { headers: { "Cache-Control": "no-store" } });
}
