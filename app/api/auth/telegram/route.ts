import { NextResponse } from "next/server";
import { verifyTelegramInitData } from "@/lib/telegram";
import { prisma } from "@/lib/db";
import { signSession } from "@/lib/auth";

export async function POST(req: Request) {
  const { initData } = await req.json();
  const botToken = process.env.BOT_TOKEN;
  if (!botToken) return NextResponse.json({ error: "BOT_TOKEN missing" }, { status: 500 });

  const v = verifyTelegramInitData(initData, botToken);
  if (!v.ok || !v.data) return NextResponse.json({ error: "INVALID_INIT_DATA" }, { status: 401 });

  const userRaw = v.data["user"];
  if (!userRaw) return NextResponse.json({ error: "NO_USER" }, { status: 401 });

  const tgUser = JSON.parse(userRaw) as { id: number; username?: string; first_name?: string };

  const user = await prisma.user.upsert({
    where: { tgId: String(tgUser.id) },
    update: { username: tgUser.username, firstName: tgUser.first_name },
    create: { tgId: String(tgUser.id), username: tgUser.username, firstName: tgUser.first_name, balance: 250 },
  });

  const token = await signSession({ userId: user.id, tgId: user.tgId });

  const res = NextResponse.json({ ok: true, user: { id: user.id, balance: user.balance } });
  res.cookies.set("session", token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}
