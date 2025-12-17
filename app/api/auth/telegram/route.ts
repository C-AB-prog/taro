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

  const secretKey = crypto.createHmac("sha256", "WebAppData").update(botToken).digest();
  const computedHash = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");

  const a = Buffer.from(computedHash, "utf8");
  const b = Buffer.from(hash, "utf8");
  const equal = a.length === b.length && crypto.timingSafeEqual(a, b);
  if (!equal) return { ok: false as const, error: "BAD_HASH" };

  return { ok: true as const, params };
}

function parseReferrerIdFromStartParam(startParam: string): string | null {
  const s = String(startParam || "").trim();
  if (!s.startsWith("ref_")) return null;
  const id = s.slice(4).trim();
  if (!id) return null;
  if (id.length < 6 || id.length > 80) return null;
  return id;
}

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

  const existing = await prisma.user.findUnique({
    where: { tgId: String(tgId) },
    select: { id: true },
  });
  const isNewUser = !existing;

  const user = await prisma.user.upsert({
    where: { tgId: String(tgId) },
    update: {
      username: tgUser?.username ?? null,
      firstName: tgUser?.first_name ?? null,
      lastSeenAt: new Date(),
    },
    create: {
      tgId: String(tgId),
      username: tgUser?.username ?? null,
      firstName: tgUser?.first_name ?? null,
      balance: 250,
      lastSeenAt: new Date(),
    },
    select: { id: true, tgId: true, username: true, firstName: true, balance: true },
  });

  // ✅ Рефералка ТОЛЬКО под твою таблицу ReferralGrant(referrerId, newUserId UNIQUE)
  const startParam = String(ver.params.get("start_param") || "").trim();
  const referrerId = parseReferrerIdFromStartParam(startParam);

  if (isNewUser && referrerId && referrerId !== user.id) {
    try {
      // referrer должен существовать
      const ref = await prisma.user.findUnique({ where: { id: referrerId }, select: { id: true } });
      if (ref) {
        const inserted = await prisma.$executeRaw`
          INSERT INTO "ReferralGrant" ("referrerId","newUserId")
          VALUES (${referrerId}, ${user.id})
          ON CONFLICT ("newUserId") DO NOTHING
        `;

        if (Number(inserted) > 0) {
          await prisma.user.update({
            where: { id: referrerId },
            data: { balance: { increment: REF_REWARD } },
          });

          // транзакция (если модель есть)
          try {
            await prisma.transaction.create({
              data: {
                userId: referrerId,
                type: "grant",
                amount: REF_REWARD,
                provider: "system",
                providerPayload: {
                  kind: "referral",
                  newUserId: user.id,
                  newUserTgId: String(tgId),
                },
              } as any,
            });
          } catch {}
        }
      }
    } catch {
      // не ломаем auth
    }
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
