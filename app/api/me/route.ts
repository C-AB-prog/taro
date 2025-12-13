import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function unauthorized() {
  const res = NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  res.cookies.set("session", "", { path: "/", maxAge: 0 });
  return res;
}

export async function GET() {
  const token = cookies().get("session")?.value;
  if (!token) return unauthorized();

  let session: any;
  try {
    session = await verifySession(token);
  } catch {
    return unauthorized();
  }

  const me = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, balance: true, username: true, firstName: true },
  });
  if (!me) return unauthorized();

  return NextResponse.json({ ok: true, me, balance: me.balance }, { headers: { "Cache-Control": "no-store" } });
}
