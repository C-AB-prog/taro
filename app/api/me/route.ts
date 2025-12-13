import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function unauthorized() {
  const res = NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  // сбросим плохую cookie, чтобы клиент заново залогинился через initData
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

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, balance: true, username: true, firstName: true },
  });

  if (!user) return unauthorized();

  return NextResponse.json({ ok: true, me: user, balance: user.balance }, { headers: { "Cache-Control": "no-store" } });
}
