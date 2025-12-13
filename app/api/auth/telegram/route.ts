import { NextResponse } from "next/server";
import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { SignJWT } from "jose";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function verifyInitData(initData: string, botToken: string) {
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return { ok: false as const, error: "NO_HASH" };

  params.delete("hash");

  const dataCheck = Array.from(params.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");

  const secretKey = crypto.createHmac("sha256", "WebAppData").update(botToken).digest();
  const computed = crypto.createHmac("sha256", secretKey).update(dataCheck).digest("hex");

  if (computed !== hash) return { ok: false as const, error: "BAD_HASH" };

  const authDate = Number(params.get("auth_date") || "0");
  if (!authDate) return { ok: false as const, error: "NO_AUTH_DATE" };

  // защита от очень старого initData (например 24 часа)
  const now = Math.floor(Date.now() / 1000);
  if (now - authDate > 60 * 60 * 24) return { ok: false as const, error: "INITDATA_EXPIRED" };

  const userJson = params.get("user");
  if (!userJson) return { ok: false as const, error: "NO_USER" };

  let user: any;
  try {
    user = JSON.parse(userJson);
  } catch {
    return { ok: false as const, error: "BAD_USER_JSON" };
  }

  if (!user?.id) return { ok: false as const, error: "NO_TG_ID" };

  return { ok: true as const, tgUser: user };
}

async function signSession(payload: { userId: string }) {
  const secret = process.env.AUTH_SECRET || "";
  if (!secret) throw new Error("NO_AUTH_SECRET");
  const key = new TextEncoder().encode(secret);

  return await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(key);
}

export async function POST(req: Request) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) {
    return NextResponse.json({ ok: false, error: "NO_TELEGRAM_BOT_TOKEN" }, { status: 500 });
  }

  const { initData } = await req.json().catch(() => ({}));
  if (!initData || typeof initData !== "string") {
    return NextResponse.json({ ok: false, error: "NO_INITDATA" }, { status: 400 });
  }

  const v = verifyInitData(initData, botToken);
  if (!v.ok) {
    return NextResponse.json({ ok: false, error: v.error }, { status: 401 });
  }

  const tg = v.tgUser;
  const tgId = String(tg.id);

  // ✅ User таблица у тебя: tgId, username, firstName, balance default 250
  const user = await prisma.user.upsert({
    where: { tgId },
    update: {
      username: tg.username ?? null,
      firstName: tg.first_name ?? null,
    },
    create: {
      tgId,
      username: tg.username ?? null,
      firstName: tg.first_name ?? null,
      // balance НЕ задаём — в БД default 250
    },
  });

  const session = await signSession({ userId: user.id });

  const res = NextResponse.json({ ok: true, userId: user.id, balance: user.balance });
  res.cookies.set("session", session, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}
