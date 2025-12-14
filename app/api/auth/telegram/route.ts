import { NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { SignJWT } from "jose";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

function buildDataCheckString(params: URLSearchParams) {
  const pairs: string[] = [];
  params.forEach((value, key) => {
    if (key === "hash") return;
    pairs.push(`${key}=${value}`);
  });
  pairs.sort();
  return pairs.join("\n");
}

function verifyTelegramWebAppInitData(initData: string, botToken: string) {
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return { ok: false as const, error: "NO_HASH" };

  const dataCheckString = buildDataCheckString(params);

  // secret_key = SHA256(bot_token)
  const secretKey = crypto.createHash("sha256").update(botToken).digest();
  const computedHash = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");

  // timing safe compare
  const a = Buffer.from(computedHash, "utf8");
  const b = Buffer.from(hash, "utf8");
  const equal = a.length === b.length && crypto.timingSafeEqual(a, b);

  if (!equal) return { ok: false as const, error: "BAD_HASH" };
  return { ok: true as const, params };
}

async function makeSessionToken(userId: string) {
  const secret = getEnv("AUTH_SECRET");
  const key = new TextEncoder().encode(secret);

  return await new SignJWT({ userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(key);
}

/* ========= referrals (через /start ref_...) ========= */

async function ensureReferralTables() {
  try {
    await prisma.$executeRawUnsafe(`CREATE EXTENSION IF NOT EXISTS pgcrypto;`);
  } catch {}

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "ReferralPending" (
      "tgId" TEXT PRIMARY KEY,
      "referrerUserId" TEXT NOT NULL,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "ReferralGrant" (
      "referredUserId" TEXT PRIMARY KEY,
      "referrerUserId" TEXT NOT NULL,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "ReferralPending_createdAt_idx" ON "ReferralPending" ("createdAt");`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "ReferralGrant_referrer_idx" ON "ReferralGrant" ("referrerUserId");`);
}

async function tryGrantReferralOnFirstLogin(params: { tgId: string; newUserId: string }) {
  await ensureReferralTables();

  const pending = await prisma.$queryRaw<Array<{ referrerUserId: string }>>`
    SELECT "referrerUserId"
    FROM "ReferralPending"
    WHERE "tgId" = ${params.tgId}
    LIMIT 1
  `;

  const referrerUserId = pending?.[0]?.referrerUserId || "";
  if (!referrerUserId) return;

  if (referrerUserId === params.newUserId) {
    // сам себе — нет
    await prisma.$executeRaw`DELETE FROM "ReferralPending" WHERE "tgId" = ${params.tgId}`;
    return;
  }

  // реферер должен существовать
  const refExists = await prisma.user.findUnique({ where: { id: referrerUserId }, select: { id: true } });
  if (!refExists) {
    await prisma.$executeRaw`DELETE FROM "ReferralPending" WHERE "tgId" = ${params.tgId}`;
    return;
  }

  // идемпотентно: начисляем только 1 раз на нового пользователя
  const inserted = await prisma.$executeRaw`
    INSERT INTO "ReferralGrant" ("referredUserId","referrerUserId")
    VALUES (${params.newUserId}, ${referrerUserId})
    ON CONFLICT ("referredUserId") DO NOTHING
  `;

  if (Number(inserted) > 0) {
    await prisma.user.update({
      where: { id: referrerUserId },
      data: { balance: { increment: 500 } },
    });
  }

  // pending удаляем в любом случае
  await prisma.$executeRaw`DELETE FROM "ReferralPending" WHERE "tgId" = ${params.tgId}`;
}

/* ================= route ================= */

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const initData = body?.initData;

  if (!initData || typeof initData !== "string") {
    return NextResponse.json({ ok: false, error: "NO_INIT_DATA" }, { status: 400 });
  }

  const botToken = getEnv("TELEGRAM_BOT_TOKEN");

  const ver = verifyTelegramWebAppInitData(initData, botToken);
  if (!ver.ok) {
    return NextResponse.json({ ok: false, error: ver.error }, { status: 401 });
  }

  const params = ver.params;

  const userRaw = params.get("user");
  if (!userRaw) return NextResponse.json({ ok: false, error: "NO_USER" }, { status: 400 });

  let tgUser: any = null;
  try {
    tgUser = JSON.parse(userRaw);
  } catch {
    return NextResponse.json({ ok: false, error: "BAD_USER_JSON" }, { status: 400 });
  }

  const tgId = tgUser?.id;
  if (!tgId) return NextResponse.json({ ok: false, error: "NO_TG_ID" }, { status: 400 });

  const tgIdStr = String(tgId);

  // определяем: это первый вход или нет
  const existed = await prisma.user.findUnique({ where: { tgId: tgIdStr }, select: { id: true } });

  let user;
  if (existed) {
    user = await prisma.user.update({
      where: { tgId: tgIdStr },
      data: {
        username: tgUser?.username ?? null,
        firstName: tgUser?.first_name ?? null,
      },
    });
  } else {
    user = await prisma.user.create({
      data: {
        tgId: tgIdStr,
        username: tgUser?.username ?? null,
        firstName: tgUser?.first_name ?? null,
        balance: 250,
      },
    });

    // ✅ реферальный бонус только при первом входе нового пользователя
    await tryGrantReferralOnFirstLogin({ tgId: tgIdStr, newUserId: user.id });
  }

  const token = await makeSessionToken(user.id);

  const isProd = process.env.NODE_ENV === "production";
  const res = NextResponse.json({
    ok: true,
    user: {
      id: user.id,
      tgId: user.tgId,
      username: user.username,
      firstName: user.firstName,
      balance: user.balance,
    },
  });

  // ✅ ВАЖНО: ставим cookie через res.cookies (иначе у части юзеров не закрепляется)
  res.cookies.set("session", token, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  return res;
}
