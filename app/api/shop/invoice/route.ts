import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySession } from "@/lib/auth";
import { tgCall } from "@/lib/telegramBot";
import { SHOP_PACKS, isPackId, makePayload } from "@/lib/shop";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function unauthorized() {
  const res = NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  res.cookies.set("session", "", { path: "/", maxAge: 0 });
  return res;
}

export async function POST(req: Request) {
  const token = cookies().get("session")?.value;
  if (!token) return unauthorized();

  let session: any;
  try {
    session = await verifySession(token);
  } catch {
    return unauthorized();
  }

  const body = await req.json().catch(() => ({}));
  const packId = body?.packId;

  if (!isPackId
