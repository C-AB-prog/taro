import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySession } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const token = cookies().get("session")?.value;
  if (!token) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const session = await verifySession(token);
  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  return NextResponse.json({
    user: { id: user.id, balance: user.balance, username: user.username, firstName: user.firstName },
  });
}
