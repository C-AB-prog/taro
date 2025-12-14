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
    });

    // lastSeenAt обновляем raw (если колонки нет — просто пропустим)
    try {
      await prisma.$executeRaw`
        UPDATE "User" SET "lastSeenAt" = now() WHERE "id" = ${user.id}
      `;
    } catch {}

    const token = await makeSessionToken(user.id);

    const res = NextResponse.json(
      {
        ok: true,
        user: {
          id: user.id,
          tgId: user.tgId,
          username: user.username,
          firstName: user.firstName,
          balance: user.balance,
        },
      },
      { headers: { "Cache-Control": "no-store" } }
    );

    const proto = req.headers.get("x-forwarded-proto") || "";
    const isHttps = proto === "https" || process.env.NODE_ENV === "production";

    // ✅ Telegram Desktop: чаще надежнее Lax
    res.cookies.set("session", token, {
      httpOnly: true,
      secure: isHttps,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });

    return res;
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: "AUTH_FAILED", message: e?.message ?? String(e) },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
