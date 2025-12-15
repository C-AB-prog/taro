import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/requireUser";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAdminTgId(tgId: string | null) {
  const adminIds = (process.env.ADMIN_TG_IDS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return tgId ? adminIds.includes(String(tgId)) : false;
}

function extractTgIdFromInitData(initData: string) {
  try {
    const params = new URLSearchParams(initData);
    const userRaw = params.get("user");
    if (!userRaw) return null;
    const u = JSON.parse(userRaw);
    return u?.id ? String(u.id) : null;
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  const hInit = req.headers.get("x-tg-init-data") || req.headers.get("x-telegram-init-data") || "";
  const cookie = req.headers.get("cookie") || "";

  let userId = "";
  try {
    userId = await requireUserId(req);
  } catch {
    const tgId = extractTgIdFromInitData(hInit);
    const isAdmin = isAdminTgId(tgId);

    return NextResponse.json(
      {
        ok: false,
        error: "UNAUTHORIZED",
        ...(isAdmin
          ? {
              debug: {
                hasInitDataHeader: !!hInit,
                initDataHeaderLen: hInit.length,
                hasCookie: cookie.includes("session="),
                cookieLen: cookie.length,
              },
            }
          : {}),
      },
      { status: 401, headers: { "Cache-Control": "no-store" } }
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, balance: true, tgId: true },
  });

  if (!user) {
    return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
  }

  const tgId = user.tgId ? String(user.tgId) : null;
  const isAdmin = isAdminTgId(tgId);

  return NextResponse.json(
    {
      ok: true,
      balance: user.balance,
      user: { id: user.id, balance: user.balance },
      ...(isAdmin
        ? {
            debug: {
              hasInitDataHeader: !!hInit,
              initDataHeaderLen: hInit.length,
              hasCookie: cookie.includes("session="),
              cookieLen: cookie.length,
            },
          }
        : {}),
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
