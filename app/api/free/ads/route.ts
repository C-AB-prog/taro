import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const rows = await prisma.advertiserChannel.findMany({
    where: { isActive: true },
    orderBy: [{ sort: "asc" }, { createdAt: "desc" }],
    select: { username: true, title: true },
  });

  return NextResponse.json({ ok: true, items: rows });
}
