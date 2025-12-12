import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySession } from "@/lib/auth";
import { prisma } from "@/lib/db";

const PACKS: Record<string, number> = {
  "99": 150,
  "199": 350,
  "399": 800,
  "799": 1800
};

export async function POST(req: Request) {
  const token = cookies().get("session")?.value;
  if (!token) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const session = await verifySession(token);
  const { tgStars } = await req.json();

  const amount = PACKS[String(tgStars)];
  if (!amount) return NextResponse.json({ error: "UNKNOWN_PACK" }, { status: 400 });

  const user = await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: session.userId },
      data: { balance: { increment: amount } },
    });
    await tx.transaction.create({
      data: {
        userId: session.userId,
        type: "topup",
        amount,
        provider: "tg_stars",
        providerPayload: { mock: true, tgStars },
      },
    });
    return tx.user.findUnique({ where: { id: session.userId } });
  });

  return NextResponse.json({ ok: true, balance: user?.balance ?? 0 });
}
