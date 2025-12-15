import "server-only";
import crypto from "crypto";
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

function normalizeInitData(raw: string) {
  const s = String(raw || "").trim();
  if (!s) return "";
  if (/%[0-9A-Fa-f]{2}/.test(s)) {
    try {
      const dec = decodeURIComponent(s);
      if (dec.includes("hash=") && dec.includes("&")) return dec;
    } catch {}
  }
  return s;
}

function parseInitDataPairs(initData: string): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  const parts = initData.split("&").filter(Boolean);
  for (const part of parts) {
    const eq = part.indexOf("=");
    const kRaw = eq >= 0 ? part.slice(0, eq) : part;
    const vRaw = eq >= 0 ? part.slice(eq + 1) : "";
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
  if (!hash) return { ok: false as const };

  dataPairs.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  const dataCheckString = dataPairs.map(([k, v]) => `${k}=${v}`).join("\n");

  const secretKey = crypto.createHash("sha256").update(botToken).digest();
  const computedHash = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");

  const a = Buffer.from(computedHash, "utf8");
  const b = Buffer.from(hash, "utf8");
  const equal = a.length === b.length && crypto.timingSafeEqual(a, b);
  if (!equal) return { ok: false as const };

  const map = new Map<string, string>();
  for (const [k, v] of pairs) map.set(k, v);

  return { ok: true as const, get: (key: string) => map.get(key) || "" };
}

export async function requireUserId(req: Request): Promise<string> {
  // 1) cookie session
  const token = parseCookie(req.headers.get("cookie"), "session");
  if (token) {
    try {
      const s = await verifySession(token);
      return s.userId;
    } catch {}
  }

  // 2) Telegram initData headers
  const initData =
    normalizeInitData(req.headers.get("x-tg-init-data") || "") ||
    normalizeInitData(req.headers.get("x-telegram-init-data") || "");

  if (!initData) throw new Error("UNAUTHORIZED");

  const botToken = getEnv("TELEGRAM_BOT_TOKEN");
  const ver = verifyTelegramWebAppInitData(initData, botToken);
  if (!ver.ok) throw new Error("UNAUTHORIZED");

  const userRaw = ver.get("user");
  if (!userRaw) throw new Error("UNAUTHORIZED");

  let tgUser: any = null;
  try {
    tgUser = JSON.parse(userRaw);
  } catch {
    throw new Error("UNAUTHORIZED");
  }

  const tgId = tgUser?.id;
  if (!tgId) throw new Error("UNAUTHORIZED");

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

  try {
    await prisma.$executeRaw`
      UPDATE "User" SET "lastSeenAt" = now() WHERE "id" = ${user.id}
    `;
  } catch {}

  return user.id;
}
