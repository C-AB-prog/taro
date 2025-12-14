import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { SignJWT } from "jose";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const REF_REWARD = 500;

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

async function ensureReferralTables() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "ReferralPending" (
      "inviteeTgId" TEXT PRIMARY KEY,
      "referrerUserId" TEXT NOT NULL,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "ReferralClaim" (
      "inviteeUserId" TEXT PRIMARY KEY,
      "referrerUserId" TEXT NOT NULL,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "ReferralPending_createdAt_idx" ON "ReferralPending" ("createdAt");
  `);
}

async function tryClaimReferralForNewUser(params: { inviteeTgId: string; inviteeUserId: string }) {
  await ensureReferralTables();

  // 1) есть ли pending?
  const rows = await prisma.$queryRawUnsafe<any[]>(
    `SELECT "referrerUserId" FROM "ReferralPending" WHERE "inviteeTgId" = $1 LIMIT 1`,
    params.inviteeTgId
  );
  const referrerUserId = rows?.[0]?.referrerUserId ? String(rows[0].referrerUserId) : "";
  if (!referrerUserId) return;

  // защита от саморефа
  if (referrerUserId === params.inviteeUserId) {
    await prisma.$executeRawUnsafe(`DELETE FROM "ReferralPending" WHERE "inviteeTgId" = $1`, params.inviteeTgId);
    return;
  }

  // 2) идемпотентность: claim только один раз на inviteeUserId
  const ins = await prisma.$executeRawUnsafe(
    `INSERT INTO "ReferralClaim" ("inviteeUserId","referrerUserId") VALUES ($1,$2) ON CONFLICT ("inviteeUserId") DO NOTHING`,
    params.inviteeUserId,
    referrerUserId
  );

  const inserted = Number(ins) > 0;
  // pending можно удалять в любом случае, чтобы не копилось
  await prisma.$executeRawUnsafe(`DELETE FROM "ReferralPending" WHERE "inviteeTgId" = $1`, params.inviteeTgId);

  if (!inserted) return;

  // 3) начисляем пригласившему +500
  try {
    await prisma.user.update({
      where: { id: referrerUserId },
      data: { balance: { increment: REF_REWARD } },
    });

    // лог в Transaction (у тебя модель есть)
    await prisma.transaction.create({
      data: {
        userId: referrerUserId,
        type: "grant",
        amount: REF_REWARD,
        provider: "system",
        providerPayload: {
          kind: "referral",
          inviteeUserId: params.inviteeUserId,
          inviteeTgId: params.inviteeTgId,
        } as any,
      },
    });
  } catch {
    // если referrer не найден — просто молча игнорим
  }
}

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

  // ✅ чтобы понять “новый пользователь или нет” — сначала check
  const existed = await prisma.user.findUnique({ where: { tgId: tgIdStr }, select: { id: true } });

  const user = await prisma.user.upsert({
    where: { tgId: tgIdStr },
    update: {
      username: tgUser?.username ?? null,
      firstName: tgUser?.first_name ?? null,
    },
    create: {
      tgId: tgIdStr,
      username: tgUser?.username ?? null,
      firstName: tgUser?.first_name ?? null,
      balance: 250,
    },
  });

  // lastSeenAt обновим raw SQL (если колонка есть — ок, если нет — молча игнорим)
  try {
    await prisma.$executeRaw`
      UPDATE "User"
      SET "lastSeenAt" = now()
      WHERE "id" = ${user.id}
    `;
  } catch {}

  // ✅ РЕФЕРАЛКА: только если пользователя раньше не было
  if (!existed) {
    await tryClaimReferralForNewUser({ inviteeTgId: tgIdStr, inviteeUserId: user.id });
  }

  const token = await makeSessionToken(user.id);

  const isProd = process.env.NODE_ENV === "production";
  cookies().set("session", token, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  return NextResponse.json({
    ok: true,
    user: {
      id: user.id,
      tgId: user.tgId,
      username: user.username,
      firstName: user.firstName,
      balance: user.balance,
    },
  });
}
