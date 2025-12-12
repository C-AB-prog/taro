import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const spreads = await prisma.spread.findMany({ orderBy: { price: "asc" } });
  return NextResponse.json({ spreads });
}
