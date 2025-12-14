import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { SignJWT } from "jose";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function getEnvOptional(...names: string[]) {
  for (const n of names) {
    const v = process.env[n];
    if (v) return v;
  }
  return "";
}

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

// ✅ Правильная проверка для Telegram WebApp initData
// secret_key = HMAC_SHA256("WebAppData", bot_token)
// hash = HMAC_SHA256(data_check_string, secret_key)
function verifyTelegramWebAppInitData(initData: string, botToken: string) {
  if (!initData) return { ok: false as const, error: "NO_INIT_DATA" };
  if (!botToken) return { ok: false as const, error: "NO_BOT_TOKEN" };

  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return { ok: false as const, error: "NO_HASH" };

  const dataCheckString = buildDataCheckString(params);

  const secretKey = crypto.createHmac("sha256", "WebAppData").update(botToken).digest();
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

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const initData = body?.initData;

  if (!initData || typeof initData !== "string") {
    return NextResponse.json({ ok: false, error: "NO_INIT_DATA" }, { status: 400 });
  }

  // поддержим оба имени env (чтобы у тебя/на Vercel не расходилось)
  const botToken = getEnvOptional("TELEGRAM_BOT_TOKEN", "BOT_TOKEN", "TELEGRAM_TOKEN");
  if (!botToken) {
    return NextResponse.json({ ok: false, error: "NO_BOT_TOKEN" }, { status: 500 });
  }

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
      // balance можно не ставить — есть default(250), но можно оставить
      balance: 250,
      lastSeenAt: now,
    },
    select: {
      id: true,
      tgId: true,
      username: true,
      firstName: true,
      balance: true,
      lastSeenAt: true,
    },
  });

  const token = await makeSessionToken(user.id);

  const isProd = process.env.NODE_ENV === "production";
  cookies().set("session", token, {
    httpOnly: true,
    secure: isProd,
    // на проде можно none, чтобы Telegram WebView не чудил с cookie
    sameSite: isProd ? "none" : "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  return NextResponse.json(
    { ok: true, user },
    { headers: { "Cache-Control": "no-store" } }
  );
}
