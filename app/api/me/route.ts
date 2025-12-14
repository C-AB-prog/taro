import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "crypto";
import { verifySession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

export async function GET(req: Request) {
  // 1) Пытаемся через cookie session
  const token = cookies().get("session")?.value;

  if (token) {
    try {
      const session = await verifySession(token);

      try {
        await prisma.$executeRaw`
          UPDATE "User"
          SET "lastSeenAt" = now()
          WHERE "id" = ${session.userId}
        `;
      } catch {}

      const user = await prisma.user.findUnique({
        where: { id: session.userId },
        select: { id: true, balance: true },
      });

      if (!user) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });

      return NextResponse.json({ ok: true, balance: user.balance, user });
    } catch {
      // пойдём во 2-й способ
    }
  }

  // 2) Фоллбэк: x-telegram-init-data (если cookie не работает у пользователя)
  const initData = req.headers.get("x-telegram-init-data") || "";
  const botToken = process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN || "";

  const v = verifyTelegramInitData(initData, botToken);
  if (!v.ok || !v.user?.id) {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  const tgId = String(v.user.id);

  // создаём/обновляем юзера (balance возьмётся дефолтом 250)
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
    select: { id: true, balance: true },
  });

  // lastSeenAt — raw, чтобы Prisma-типы не ругались
  try {
    await prisma.$executeRaw`
      UPDATE "User"
      SET "lastSeenAt" = now()
      WHERE "id" = ${u.id}
    `;
  } catch {}

  return NextResponse.json({ ok: true, balance: u.balance, user: { id: u.id, balance: u.balance } });
}
