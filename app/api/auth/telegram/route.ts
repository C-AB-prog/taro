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
  const s = String(raw || "").trim();
  if (!s) return "";
  // Иногда прилетает url-encoded целиком
  if (/%[0-9A-Fa-f]{2}/.test(s)) {
    try {
      const dec = decodeURIComponent(s);
      if (dec.includes("hash=") && dec.includes("&")) return dec;
    } catch {}
  }
  return s;
}

/**
 * ВАЖНО:
 * URLSearchParams по стандарту трактует '+' как пробел.
 * В Telegram initData '+' может быть частью значения => ломает hash.
 * Поэтому парсим вручную и декодим так, чтобы '+' оставался '+'.
 */
function parseInitDataPairs(initData: string): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  const parts = initData.split("&").filter(Boolean);

  for (const part of parts) {
    const eq = part.indexOf("=");
    const kRaw = eq >= 0 ? part.slice(0, eq) : part;
    const vRaw = eq >= 0 ? part.slice(eq + 1) : "";

    // сохраняем '+' как '+'
    const k = decodeURIComponent(kRaw.replace(/\+/g, "%2B"));
    const v = decodeURIComponent(vRaw.replace(/\+/g, "%2B"));

    out.push([k, v]);
  }
  return out;
}

function verifyTelegramWebAppInitData(initData: string, botToken: string) {
  const pairs = parseInitDataPairs(initData);

  let hash = "";
  const dataPairs: Array<[string, string]> = [];
  for (const [k, v] of pairs) {
    if (k === "hash") hash = v;
    else dataPairs.push([k, v]);
  }
  if (!hash) return { ok: false as const, error: "NO_HASH" };

  dataPairs.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  const dataCheckString = dataPairs.map(([k, v]) => `${k}=${v}`).join("\n");

  // secret_key = SHA256(bot_token)
  const secretKey = crypto.createHash("sha256").update(botToken).digest();
  const computedHash = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");

  const a = Buffer.from(computedHash, "utf8");
  const b = Buffer.from(hash, "utf8");
  const equal = a.length === b.length && crypto.timingSafeEqual(a, b);
  if (!equal) return { ok: false as const, error: "BAD_HASH" };

  const map = new Map<string, string>();
  for (const [k, v] of pairs) map.set(k, v);

  return { ok: true as const, get: (key: string) => map.get(key) || "" };
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

  try {
    await prisma.transaction.create({
      data: {
        userId: pending.referrerUserId,
        type: "grant",
        amount: REF_REWARD,
        provider: "system",
        providerPayload: { kind: "referral", inviteeUserId: opts.inviteeUserId, inviteeTgId: opts.inviteeTgId },
      } as any,
    });
  } catch {}

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

  const userRaw = ver.get("user");
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
    await prisma.$executeRaw`
      UPDATE "User" SET "lastSeenAt" = now() WHERE "id" = ${user.id}
    `;
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
