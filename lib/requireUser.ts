import "server-only";
import crypto from "crypto";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/auth";

function getEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

function parseCookie(cookieHeader: string | null, key: string) {
  if (!cookieHeader) return "";
  const parts = cookieHeader.split(";").map((s) => s.trim());
  for (const p of parts) {
    const idx = p.indexOf("=");
    if (idx < 0) continue;
    const k = p.slice(0, idx).trim();
    if (k === key) return decodeURIComponent(p.slice(idx + 1));
  }
  return "";
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

  // (опционально) можно проверить auth_date, но лучше не жёстко, чтобы не ломать Desktop
  return { ok: true as const, params };
}

export async function requireUserId(req: Request): Promise<string> {
  // 1) cookie session (основной путь)
  const token =
    cookies().get("session")?.value ||
    parseCookie(req.headers.get("cookie"), "session");

  if (token) {
    try {
      const s = await verifySession(token);
      return s.userId;
    } catch {
      // если cookie битая — попробуем initData fallback
    }
  }

  // 2) fallback: Telegram initData из заголовка
  const initData = req.headers.get("x-tg-init-data") || "";
  if (!initData) throw new Error("UNAUTHORIZED");

  const botToken = getEnv("TELEGRAM_BOT_TOKEN");
  const ver = verifyTelegramWebAppInitData(initData, botToken);
  if (!ver.ok) throw new Error("UNAUTHORIZED");

  const userRaw = ver.params.get("user");
  if (!userRaw) throw new Error("UNAUTHORIZED");

  let tgUser: any = null;
  try {
    tgUser = JSON.parse(userRaw);
  } catch {
    throw new Error("UNAUTHORIZED");
  }

  const tgId = tgUser?.id;
  if (!tgId) throw new Error("UNAUTHORIZED");

  const now = new Date();

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
    select: { id: true },
  });

  // lastSeenAt если есть — не ломаемся
  try {
    await prisma.$executeRaw`
      UPDATE "User"
      SET "lastSeenAt" = now()
      WHERE "id" = ${user.id}
    `;
  } catch {}

  return user.id;
}
