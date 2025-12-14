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

async function ensureOffersTables() {
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

export async function POST(req: Request) {
  const token = cookies().get("session")?.value;
  if (!token) return unauthorized();

  let session: { userId: string };
  try {
    session = await verifySession(token);
  } catch {
    return unauthorized();
  }

  await ensureOffersTables();

  const body = await req.json().catch(() => ({}));
  const offerId = String(body?.offerId || "").trim();
  if (!offerId) return NextResponse.json({ ok: false, error: "BAD_REQUEST" }, { status: 400 });

  const offerRows = await prisma.$queryRaw<
    Array<{ reward: number; title: string; url: string }>
  >`SELECT "reward","title","url" FROM "AdOffer" WHERE "id" = ${offerId} AND "active" = true LIMIT 1`;

  const offer = offerRows[0];
  if (!offer) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });

  // идемпотентно: 1 раз на оффер
  const inserted = await prisma.$executeRaw`
    INSERT INTO "AdClaim" ("userId","offerId")
    VALUES (${session.userId}, ${offerId})
    ON CONFLICT ("userId","offerId") DO NOTHING
  `;

  if (Number(inserted) > 0) {
    await prisma.user.update({
      where: { id: session.userId },
      data: { balance: { increment: offer.reward } },
    });

    // опционально лог транзакций, если хочешь:
    // await prisma.transaction.create({ data: { userId: session.userId, type: "grant", amount: offer.reward, provider: "system", providerPayload: { offerId } } as any });

    return NextResponse.json({ ok: true, granted: true, reward: offer.reward }, { headers: { "Cache-Control": "no-store" } });
  }

  return NextResponse.json({ ok: true, granted: false, reward: offer.reward }, { headers: { "Cache-Control": "no-store" } });
}
