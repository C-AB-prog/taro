import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveCardImage } from "@/lib/tarot";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function mskDayBoundsUtc(now = new Date()) {
  const offset = 3 * 60 * 60 * 1000; // MSK = UTC+3
  const msk = new Date(now.getTime() + offset);
  msk.setUTCHours(0, 0, 0, 0);
  const start = new Date(msk.getTime() - offset);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}

export async function GET() {
  try {
    const token = cookies().get("session")?.value;
    if (!token) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

    const session = await verifySession(token);
    const { start, end } = mskDayBoundsUtc(new Date());

    const spin = await prisma.wheelSpin.findFirst({
      where: {
        userId: session.userId,
        date: { gte: start, lt: end },
      },
      include: { card: true },
      orderBy: { date: "desc" },
    });

    if (!spin) return NextResponse.json({ already: false });

    const c = spin.card;

    return NextResponse.json({
      already: true,
      card: {
        slug: c.slug,
        titleRu: c.titleRu,
        meaningRu: c.meaningRu,
        adviceRu: c.adviceRu,
        image: resolveCardImage(c.slug),
      },
    });
  } catch {
    return NextResponse.json({ error: "STATUS_FAILED" }, { status: 500 });
  }
}
