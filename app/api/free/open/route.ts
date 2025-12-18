import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/requireUser";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const userId = await requireUserId(req);
  const body = await req.json().catch(() => ({}));
  const offerId = String(body?.offerId || "").trim();
  if (!offerId) return NextResponse.json({ ok: false, error: "BAD_OFFER" }, { status: 400 });

  const offer = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT "id" FROM "AdOffer" WHERE "id" = ${offerId} AND "active" = true LIMIT 1
  `;
  if (!offer[0]) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });

  try {
    await prisma.$executeRaw`
      INSERT INTO "AdOpen" ("userId","offerId")
      VALUES (${userId}, ${offerId})
      ON CONFLICT ("userId","offerId") DO NOTHING
    `;
  } catch {}

  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
