import { NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { signSession } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const REF_REWARD = 500;

function getEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

function normalizeInitData(raw: string) {
  // НЕ делаем decodeURIComponent всей строки — это может ломать hash
  return String(raw || "").trim();
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

  // ✅ ВАЖНО: для WebApp secret_key = HMAC_SHA256("WebAppData", bot_token)
  const secretKey = crypto.createHmac("sha256", "WebAppData").update(botToken).digest();

  const computedHash = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");

  const a = Buffer.from(computedHash, "utf8");
  const b = Buffer.from(hash, "utf8");
  const equal = a.length === b.length && crypto.timingSafeEqual(a, b);
  if (!equal) return { ok: false as const, error: "BAD_HASH" };

  return { ok: true as const, params };
}

/* ================== Referral tables + grant ================== */

async function ensureReferralTables() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "ReferralPending" (
      "inviteeTgId" TEXT PRIMARY KEY,
      "referrerUserId" TEXT NOT NULL,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "ReferralGrant" (
      "inviteeUserId" TEXT PRIMARY KEY,
      "referrerUserId" TEXT NOT NULL,
      "inviteeTgId" TEXT NOT NULL,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "ReferralPending_referrer_idx" ON "ReferralPending" ("referrerUserId");
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "ReferralGrant_referrer_idx" ON "ReferralGrant" ("referrerUserId");
  `);
}

async function tryGrantReferralFromPending(opts: { inviteeTgId: string; inviteeUserId: string; isNewUser: boolean }) {
  await ensureReferralTables();

  const pendingRows = await prisma.$queryRaw<Array<{ referrerUserId: string }>>`
    SELECT "referrerUserId"
    FROM "ReferralPending"
    WHERE "inviteeTgId" = ${opts.inviteeTgId}
    LIMIT 1
  `;
  const pending = pendingRows[0];
  if (!pending) return { granted: false as const, reason: "NO_PENDING" };

  // чистим pending всегда
  try {
    await prisma.$executeRaw`DELETE FROM "ReferralPending" WHERE "inviteeTgId" = ${opts.inviteeTgId}`;
  } catch {}

  if (!opts.isNewUser) return { granted: false as const, reason: "NOT_NEW" };
  if (pending.referrerUserId === opts.inviteeUserId) return { granted: false as const, reason: "SELF" };

  const ref = await prisma.user.findUnique({ where: { id: pending.referrerUserId }, select: { id: true } });
  if (!ref) return { granted: false as const, reason: "REFERRER_NOT_FOUND" };

  const inserted = await prisma.$executeRaw`
    INSERT INTO "ReferralGrant" ("inviteeUserId","referrerUserId","inviteeTgId")
    VALUES (${opts.inviteeUserId}, ${pending.referrerUserId}, ${opts.inviteeTgId})
    ON CONFLICT ("inviteeUserId") DO NOTHING
  `;
  if (Number(inserted) <= 0) return { granted: false as const, reason: "ALREADY" };

  await prisma.user.update({
    where: { id: pending.referrerUserId },
    data: { balance: { increment: REF_REWARD } },
  });

  return { granted: true as const, referrerUserId: pending.referrerUserId };
}

/* ================== Route ================== */

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));

  const initData =
    normalizeInitData(body?.initData) ||
    normalizeInitData(req.headers.get("x-tg-init-data") || "") ||
    normalizeInitData(req.headers.get("x-telegram-init-data") || "");

  if (!initData) return NextResponse.json({ ok: false, error: "NO_INIT_DATA" }, { status: 400 });

  const botToken = getEnv("TELEGRAM_BOT_TOKEN");
  const ver = verifyTelegramWebAppInitData(initData, botToken);
  if (!ver.ok) return NextResponse.json({ ok: false, error: ver.error }, { status: 401 });

  const userRaw = ver.params.get("user");
  if (!userRaw) return NextResponse.json({ ok: false, error: "NO_USER" }, { status: 400 });

  let tgUser: any = null;
  try {
    tgUser = JSON.parse(userRaw);
  } catch {
    return NextResponse.json({ ok: false, error: "BAD_USER_JSON" }, { status: 400 });
  }

  const tgId = tgUser?.id;
  if (!tgId) return NextResponse.json({ ok: false, error: "NO_TG_ID" }, { status: 400 });

  const existing = await prisma.user.findUnique({ where: { tgId: String(tgId) }, select: { id: true } });
  const isNewUser = !existing;

  const user = await prisma.user.upsert({
    where: { tgId: String(tgId) },
    update: {
      username: tgUser?.username ?? null,
      firstName: tgUser?.first_name ?? null,
    },
    create: {
      tgId: String(tgId),
      username: tgUser?.username ?? null,
      firstName: tgUser?.first_name ?? null,
      balance: 250,
    },
    select: { id: true, tgId: true, balance: true },
  });

  try {
    await prisma.$executeRaw`UPDATE "User" SET "lastSeenAt" = now() WHERE "id" = ${user.id}`;
  } catch {}

  try {
    await tryGrantReferralFromPending({
      inviteeTgId: String(tgId),
      inviteeUserId: user.id,
      isNewUser,
    });
  } catch {}

  const token = await signSession({ userId: user.id });

  const isProd = process.env.NODE_ENV === "production";
  const res = NextResponse.json({ ok: true, user }, { headers: { "Cache-Control": "no-store" } });

  res.cookies.set("session", token, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "none" : "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  return res;
}
