import crypto from "crypto";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/auth";

function verifyTelegramInitData(initData: string, botToken: string) {
  if (!initData || !botToken) return { ok: false as const };

  const sp = new URLSearchParams(initData);
  const hash = sp.get("hash") || "";
  if (!hash) return { ok: false as const };

  const pairs: string[] = [];
  sp.forEach((value, key) => {
    if (key === "hash") return;
    pairs.push(`${key}=${value}`);
  });
  pairs.sort();
  const dataCheckString = pairs.join("\n");

  const secretKey = crypto.createHmac("sha256", "WebAppData").update(botToken).digest();
  const computedHash = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");

  if (computedHash !== hash) return { ok: false as const };

  let user: any = null;
  const userRaw = sp.get("user");
  if (userRaw) {
    try {
      user = JSON.parse(userRaw);
    } catch {
      user = null;
    }
  }

  return { ok: true as const, user };
}

export async function requireUserId(req: Request): Promise<string> {
  // 1) cookie session
  const token = cookies().get("session")?.value;
  if (token) {
    try {
      const s = await verifySession(token);

      try {
        await prisma.$executeRaw`
          UPDATE "User" SET "lastSeenAt" = now() WHERE "id" = ${s.userId}
        `;
      } catch {}

      return s.userId;
    } catch {
      // fallback ниже
    }
  }

  // 2) header initData
  const initData = req.headers.get("x-telegram-init-data") || "";
  const botToken = process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN || "";
  const v = verifyTelegramInitData(initData, botToken);
  if (!v.ok || !v.user?.id) throw new Error("UNAUTHORIZED");

  const tgId = String(v.user.id);

  const u = await prisma.user.upsert({
    where: { tgId },
    update: {
      username: v.user?.username ?? null,
      firstName: v.user?.first_name ?? null,
    },
    create: {
      tgId,
      username: v.user?.username ?? null,
      firstName: v.user?.first_name ?? null,
    },
    select: { id: true },
  });

  try {
    await prisma.$executeRaw`
      UPDATE "User" SET "lastSeenAt" = now() WHERE "id" = ${u.id}
    `;
  } catch {}

  return u.id;
}
