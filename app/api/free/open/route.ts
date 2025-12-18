import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/requireUser";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function noStoreJson(data: any, status = 200) {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: Request) {
  let userId = "";
  try {
    userId = await requireUserId(req);
  } catch {
    return noStoreJson({ ok: false, error: "UNAUTHORIZED" }, 401);
  }

  const body = await req.json().catch(() => ({}));
  const offerId = String(body?.offerId || "").trim();
  if (!offerId) return noStoreJson({ ok: false, error: "BAD_OFFER" }, 400);

  try {
    const offer = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT "id"
      FROM "AdOffer"
      WHERE "id" = ${offerId} AND "active" = true
      LIMIT 1
    `;
    if (!offer[0]) return noStoreJson({ ok: false, error: "NOT_FOUND" }, 404);

    // фиксируем open (идемпотентно)
    await prisma.$executeRaw`
      INSERT INTO "AdOpen" ("userId","offerId")
      VALUES (${userId}, ${offerId})
      ON CONFLICT ("userId","offerId") DO NOTHING
    `;

    return noStoreJson({ ok: true });
  } catch (e: any) {
    return noStoreJson(
      {
        ok: false,
        error: "OPEN_FAIL",
        message: String(e?.message || e),
      },
      500
    );
  }
}
