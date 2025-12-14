import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const REWARD = 500;

export async function POST(req: Request) {
  const token = cookies().get("session")?.value;
  if (!token) return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });

  const session = await verifySession(token);
  const body = await req.json().catch(() => ({}));
  const referrerId = String(body?.referrerId || "");

  if (!referrerId || referrerId.length < 6) return NextResponse.json({ ok: true, granted: false });
  if (referrerId === session.userId) return NextResponse.json({ ok: true, granted: false });

  // считаем “новым” если аккаунт создан недавно (подстраховка от накруток)
  const me = await prisma.user.findUnique({ where: { id: session.userId }, select: { createdAt: true } });
  if (!me) return NextResponse.json({ ok: true, granted: false });

  const ageMin = (Date.now() - new Date(me.createdAt).getTime()) / 60000;
  if (ageMin > 60) return NextResponse.json({ ok: true, granted: false }); // старый пользователь — не даём

  // идемпотентность: один новый пользователь может принести награду только один раз
  try {
    await prisma.referralGrant.create({
      data: { referrerId, newUserId: session.userId },
    });
  } catch {
    return NextResponse.json({ ok: true, granted: false }); // уже начисляли
  }

  // начисляем пригласившему
  await prisma.user.update({
    where: { id: referrerId },
    data: { balance: { increment: REWARD } },
  });

  return NextResponse.json({ ok: true, granted: true, amount: REWARD });
}
