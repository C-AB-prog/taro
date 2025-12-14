import { NextResponse } from "next/server";
import { cookies } from "next/headers";
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
  const computedHash = crypto
    .createHmac("sha256", secretKey)
    .update(dataCheckString)
    .digest("hex");

  // timing safe compare
  const a = Buffer.from(computedHash, "utf8");
  const b = Buffer.from(hash, "utf8");
  const equal = a.length === b.length && crypto.timingSafeEqual(a, b);

  if (!equal) return { ok: false as const, error: "BAD_HASH" };

  // опционально можно проверять auth_date (не обязательно)
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

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const initData = body?.initData;

  if (!initData || typeof initData !== "string") {
    return NextResponse.json({ ok: false, error: "NO_INIT_DATA" }, { status: 400 });
  }

  // ⚠️ Убедись, что имя env совпадает с тем, что ты реально добавил на Vercel
  // Если у тебя BOT_TOKEN — просто замени строку ниже на getEnv("BOT_TOKEN")
  const botToken = getEnv("TELEGRAM_BOT_TOKEN");

  const ver = verifyTelegramWebAppInitData(initData, botToken);
  if (!ver.ok) {
    return NextResponse.json({ ok: false, error: ver.error }, { status: 401 });
  }

  const params = ver.params;

  const userRaw = params.get("user");
  if (!userRaw) {
    return NextResponse.json({ ok: false, error: "NO_USER" }, { status: 400 });
  }

  let tgUser: any = null;
  try {
    tgUser = JSON.parse(userRaw);
  } catch {
    return NextResponse.json({ ok: false, error: "BAD_USER_JSON" }, { status: 400 });
  }

  const tgId = tgUser?.id;
  if (!tgId) {
    return NextResponse.json({ ok: false, error: "NO_TG_ID" }, { status: 400 });
  }

  const now = new Date();

  // ✅ тут и есть "create" и "update" (upsert)
  const user = await prisma.user.upsert({
    where: { tgId: String(tgId) },
    update: {
      username: tgUser?.username ?? null,
      firstName: tgUser?.first_name ?? null,
      lastSeenAt: now,
    },
    create: {
      tgId: String(tgId),
      username: tgUser?.username ?? null,
      firstName: tgUser?.first_name ?? null,
      balance: 250, // стартовая валюта (и так стоит default в SQL, но пусть будет явно)
      lastSeenAt: now,
    },
  });

  const token = await makeSessionToken(user.id);

  // cookie session
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
      lastSeenAt: user.lastSeenAt,
    },
  });
}
