// lib/reqUser.ts
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/auth";
import { verifyTelegramInitData } from "@/lib/telegramInitData";

export async function getUserIdFromRequest(req: Request): Promise<string | null> {
  // 1) пробуем куку session
  const token = cookies().get("session")?.value;
  if (token) {
    try {
      const s = await verifySession(token);
      if (s?.userId) return s.userId;
    } catch {}
  }

  // 2) fallback: пробуем initData из заголовка (самый надежный)
  const initData = req.headers.get("x-telegram-init-data") || "";
  const botToken = process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN || "";
  const v = verifyTelegramInitData(initData, botToken);
  if (!v.ok || !v.user?.id) return null;

  const tgId = String(v.user.id);

  // создаём/обновляем юзера
  const user = await prisma.user.upsert({
    where: { tgId },
    update: {
      username: v.user.username ?? null,
      firstName: v.user.first_name ?? null,
    },
    create: {
      tgId,
      username: v.user.username ?? null,
      firstName: v.user.first_name ?? null,
      // balance по дефолту = 250 (в prisma)
    },
    select: { id: true },
  });

  // lastSeenAt (если колонка есть — обновим тихо; если нет — не падаем)
  try {
    await prisma.$executeRaw`UPDATE "User" SET "lastSeenAt" = now() WHERE "id" = ${user.id};`;
  } catch {}

  return user.id;
}
