import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const token = cookies().get("session")?.value;
  if (!token) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });

  let session: { userId: string };
  try {
    session = await verifySession(token);
  } catch {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const offerId = String(body?.offerId || "").trim();
  if (!offerId) return NextResponse.json({ ok: false, error: "BAD_REQUEST" }, { status: 400 });

  // находим оффер
  const offer = await prisma.$queryRawUnsafe<any[]>(`
    SELECT "id","reward" FROM "AdOffer"
    WHERE "id" = '${offerId.replace(/'/g, "''")}' AND "active" = true
    LIMIT 1
  `);
  if (!offer?.[0]) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });

  const reward = Number(offer[0].reward) || 0;
  if (reward <= 0) return NextResponse.json({ ok: false, error: "BAD_REWARD" }, { status: 400 });

  // идемпотентность: один раз на пользователя/оффер
  const inserted = await prisma.$executeRawUnsafe(`
    INSERT INTO "AdClaim" ("userId","offerId")
    VALUES ('${session.userId.replace(/'/g, "''")}', '${offerId.replace(/'/g, "''")}')
    ON CONFLICT ("userId","offerId") DO NOTHING
  `);

  if (Number(inserted) <= 0) {
    return NextResponse.json({ ok: true, granted: false, error: "ALREADY" });
  }

  await prisma.$transaction([
    prisma.user.update({
      where: { id: session.userId },
      data: { balance: { increment: reward } },
    }),
    prisma.transaction.create({
      data: {
        userId: session.userId,
        type: "grant",
        amount: reward,
        provider: "system",
        providerPayload: { kind: "ad_offer", offerId },
      },
    }),
  ]);

  return NextResponse.json({ ok: true, granted: true, reward }, { headers: { "Cache-Control": "no-store" } });
}
