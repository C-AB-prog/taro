import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const REWARD = 500;

// создаём таблицу один раз (через raw SQL), Prisma-схему не трогаем => ничего не ломаем
async function ensureReferralTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "ReferralGrant" (
      "referredUserId" TEXT PRIMARY KEY,
      "referrerUserId" TEXT NOT NULL,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "ReferralGrant_referrer_idx" ON "ReferralGrant" ("referrerUserId");
  `);
}

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
  const referrerId = String(body?.referrerId || "").trim();

  if (!referrerId) return NextResponse.json({ ok: true, granted: false, reason: "NO_REFERRER" });
  if (referrerId === session.userId) return NextResponse.json({ ok: true, granted: false, reason: "SELF" });

  // реферер должен существовать
  const referrer = await prisma.user.findUnique({
    where: { id: referrerId },
    select: { id: true },
  });
  if (!referrer) return NextResponse.json({ ok: true, granted: false, reason: "REFERRER_NOT_FOUND" });

  // проверяем что "друг новый": недавно создан + нет активности
  const me = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, createdAt: true },
  });
  if (!me) return NextResponse.json({ ok: true, granted: false, reason: "ME_NOT_FOUND" });

  const createdMs = new Date(me.createdAt).getTime();
  const ageMs = Date.now() - createdMs;

  const [spins, purchases, txs] = await Promise.all([
    prisma.wheelSpin.count({ where: { userId: me.id } }),
    prisma.spreadPurchase.count({ where: { userId: me.id } }),
    prisma.transaction.count({ where: { userId: me.id } }),
  ]);

  // “сразу зашёл” = допустим в первые 2 часа и без действий
  const eligible = ageMs <= 2 * 60 * 60 * 1000 && spins === 0 && purchases === 0 && txs === 0;
  if (!eligible) return NextResponse.json({ ok: true, granted: false, reason: "NOT_NEW" });

  await ensureReferralTable();

  // идемпотентность: один и тот же новый юзер может принести бонус только один раз
  const inserted = await prisma.$executeRaw`
    INSERT INTO "ReferralGrant" ("referredUserId","referrerUserId")
    VALUES (${me.id}, ${referrerId})
    ON CONFLICT ("referredUserId") DO NOTHING
  `;

  if (Number(inserted) <= 0) {
    return NextResponse.json({ ok: true, granted: false, reason: "ALREADY" });
  }

  // начисляем +500 пригласившему
  await prisma.$transaction([
    prisma.user.update({
      where: { id: referrerId },
      data: { balance: { increment: REWARD } },
    }),
    prisma.transaction.create({
      data: {
        userId: referrerId,
        type: "grant",
        amount: REWARD,
        provider: "system",
        providerPayload: { kind: "referral", referredUserId: me.id },
      },
    }),
  ]);

  return NextResponse.json({ ok: true, granted: true, reward: REWARD });
}
