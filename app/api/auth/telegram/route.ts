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

/** ===== Referral tables (raw, без prisma schema) ===== */
async function ensureReferralTables() {
  try {
    await prisma.$executeRawUnsafe(`CREATE EXTENSION IF NOT EXISTS pgcrypto;`);
  } catch {}

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

  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "ReferralPending_createdAt_idx" ON "ReferralPending" ("createdAt");`);
}

/** начисляем 500 рефереру ТОЛЬКО если:
 *  - юзер новый
 *  - pending есть
 *  - еще не выдавали grant
 */
async function tryApplyReferralOnFirstLogin(params: { inviteeUserId: string; inviteeTgId: string }) {
  const REWARD = 500;

  await ensureReferralTables();

  const rows = await prisma.$queryRaw<Array<{ referrerUserId: string }>>`
    SELECT "referrerUserId"
    FROM "ReferralPending"
    WHERE "inviteeTgId" = ${params.inviteeTgId}
    LIMIT 1
  `;
  const referrerUserId = rows?.[0]?.referrerUserId;
  if (!referrerUserId) return;

  if (referrerUserId === params.inviteeUserId) {
    // защита от саморефа
    await prisma.$executeRaw`DELETE FROM "ReferralPending" WHERE "inviteeTgId" = ${params.inviteeTgId}`;
    return;
  }

  await prisma.$transaction(async (tx) => {
    // идемпотентность: только 1 раз на invitee
    const inserted = await tx.$executeRaw`
      INSERT INTO "ReferralGrant" ("inviteeUserId","referrerUserId","inviteeTgId")
      VALUES (${params.inviteeUserId}, ${referrerUserId}, ${params.inviteeTgId})
      ON CONFLICT ("inviteeUserId") DO NOTHING
    `;

    if (Number(inserted) <= 0) return;

    // начисляем рефереру
    try {
      await tx.user.update({
        where: { id: referrerUserId },
        data: { balance: { increment: REWARD } },
      });
    } catch {
      // если реферер не найден — просто не начисляем
      return;
    }

    // чистим pending
    await tx.$executeRaw`DELETE FROM "ReferralPending" WHERE "inviteeTgId" = ${params.inviteeTgId}`;
  });
}

export async function POST(req: Request) {
  try {
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

    // ✅ важно: определяем "новый юзер" без upsert
    const existed = await prisma.user.findUnique({ where: { tgId: tgIdStr }, select: { id: true } });

    const user = existed
      ? await prisma.user.update({
          where: { tgId: tgIdStr },
          data: {
            username: tgUser?.username ?? null,
            firstName: tgUser?.first_name ?? null,
          },
        })
      : await prisma.user.create({
          data: {
            tgId: tgIdStr,
            username: tgUser?.username ?? null,
            firstName: tgUser?.first_name ?? null,
            balance: 250,
          },
        });

    // lastSeenAt (если колонка есть) — raw
    try {
      await prisma.$executeRaw`UPDATE "User" SET "lastSeenAt" = now() WHERE "id" = ${user.id}`;
    } catch {}

    // ✅ если юзер новый — пробуем применить рефералку
    if (!existed) {
      await tryApplyReferralOnFirstLogin({ inviteeUserId: user.id, inviteeTgId: tgIdStr });
    }

    const token = await makeSessionToken(user.id);

    const res = NextResponse.json(
      { ok: true, user: { id: user.id, tgId: user.tgId, username: user.username, firstName: user.firstName, balance: user.balance } },
      { headers: { "Cache-Control": "no-store" } }
    );

    const proto = req.headers.get("x-forwarded-proto") || "";
    const isHttps = proto === "https" || process.env.NODE_ENV === "production";

    // ✅ Telegram Desktop: чаще стабильнее sameSite=lax
    res.cookies.set("session", token, {
      httpOnly: true,
      secure: isHttps,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });

    return res;
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: "AUTH_FAILED", message: e?.message ?? String(e) }, { status: 500 });
  }
}
