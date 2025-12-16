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

  // ✅ правильный ключ для WebApp
  const secretKey = crypto.createHmac("sha256", "WebAppData").update(botToken).digest();
  const computedHash = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");

  const a = Buffer.from(computedHash, "utf8");
  const b = Buffer.from(hash, "utf8");
  const equal = a.length === b.length && crypto.timingSafeEqual(a, b);
  if (!equal) return { ok: false as const, error: "BAD_HASH" };

  return { ok: true as const, params };
}

/* ================== Referral tables ================== */

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

async function grantReferralOnce(params: {
  inviteeUserId: string;
  inviteeTgId: string;
  referrerUserId: string;
}) {
  await ensureReferralTables();

  // защита от саморефа
  if (params.referrerUserId === params.inviteeUserId) return { ok: false as const, reason: "SELF" };

  // реферер должен существовать
  const ref = await prisma.user.findUnique({ where: { id: params.referrerUserId }, select: { id: true } });
  if (!ref) return { ok: false as const, reason: "REFERRER_NOT_FOUND" };

  // выдаём только 1 раз на inviteeUserId
  const inserted = await prisma.$executeRaw`
    INSERT INTO "ReferralGrant" ("inviteeUserId","referrerUserId","inviteeTgId")
    VALUES (${params.inviteeUserId}, ${params.referrerUserId}, ${params.inviteeTgId})
    ON CONFLICT ("inviteeUserId") DO NOTHING
  `;
  if (Number(inserted) <= 0) return { ok: false as const, reason: "ALREADY" };

  await prisma.user.update({
    where: { id: params.referrerUserId },
    data: { balance: { increment: REF_REWARD } },
  });

  try {
    await prisma.transaction.create({
      data: {
        userId: params.referrerUserId,
        type: "grant",
        amount: REF_REWARD,
        provider: "system",
        providerPayload: {
          kind: "referral",
          inviteeUserId: params.inviteeUserId,
          inviteeTgId: params.inviteeTgId,
        },
      } as any,
    });
  } catch {}

  return { ok: true as const };
}

async function tryGrantReferralFromPending(opts: {
  inviteeTgId: string;
  inviteeUserId: string;
  isNewUser: boolean;
}) {
  await ensureReferralTables();

  const pendingRows = await prisma.$queryRaw<Array<{ referrerUserId: string }>>`
    SELECT "referrerUserId"
    FROM "ReferralPending"
    WHERE "inviteeTgId" = ${opts.inviteeTgId}
    LIMIT 1
  `;
  const pending = pendingRows[0];
  if (!pending) return { ok: false as const, reason: "NO_PENDING" };

  // чистим pending всегда
  try {
    await prisma.$executeRaw`DELETE FROM "ReferralPending" WHERE "inviteeTgId" = ${opts.inviteeTgId}`;
  } catch {}

  if (!opts.isNewUser) return { ok: false as const, reason: "NOT_NEW" };

  return grantReferralOnce({
    inviteeUserId: opts.inviteeUserId,
    inviteeTgId: opts.inviteeTgId,
    referrerUserId: pending.referrerUserId,
  });
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
    select: { id: true, tgId: true, username: true, firstName: true, balance: true },
  });

  try {
    await prisma.$executeRaw`UPDATE "User" SET "lastSeenAt" = now() WHERE "id" = ${user.id}`;
  } catch {}

  // ✅ 1) СНАЧАЛА: рефералка напрямую через start_param (самый надёжный путь)
  // Telegram передаёт start_param в initData если запускали из deep link start=...
  const startParam = String(ver.params.get("start_param") || "").trim();
  if (isNewUser && startParam.startsWith("ref_")) {
    const referrerUserId = startParam.slice(4).trim();
    if (referrerUserId) {
      try {
        await grantReferralOnce({
          inviteeUserId: user.id,
          inviteeTgId: String(tgId),
          referrerUserId,
        });
      } catch {}
    }
  } else {
    // ✅ 2) fallback: старый механизм через /start → ReferralPending
    try {
      await tryGrantReferralFromPending({
        inviteeTgId: String(tgId),
        inviteeUserId: user.id,
        isNewUser,
      });
    } catch {}
  }

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
