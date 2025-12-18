import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/requireUser";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAdminTgIdFromInitData(initData: string) {
  try {
    const adminIds = (process.env.ADMIN_TG_IDS || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const params = new URLSearchParams(initData);
    const userRaw = params.get("user");
    if (!userRaw) return false;
    const u = JSON.parse(userRaw);
    const tgId = u?.id ? String(u.id) : "";
    return tgId ? adminIds.includes(tgId) : false;
  } catch {
    return false;
  }
}

export async function GET(req: Request) {
  const hInit = req.headers.get("x-tg-init-data") || req.headers.get("x-telegram-init-data") || "";
  const isAdmin = isAdminTgIdFromInitData(hInit);

  // 1) Всегда пробуем читать AdOffer (чтобы понять, есть ли записи в БД)
  let offers: Array<{ id: string; title: string; url: string; reward: number; active: boolean; createdAt: Date }> = [];
  let adOfferCount = 0;
  let adOfferActiveCount = 0;
  let adOfferLatest: any = null;

  try {
    const [c1] = await prisma.$queryRaw<Array<{ c: bigint }>>`
      SELECT COUNT(*)::bigint AS c FROM "AdOffer"
    `;
    const [c2] = await prisma.$queryRaw<Array<{ c: bigint }>>`
      SELECT COUNT(*)::bigint AS c FROM "AdOffer" WHERE "active" = true
    `;
    adOfferCount = Number(c1?.c || 0);
    adOfferActiveCount = Number(c2?.c || 0);

    const latest = await prisma.$queryRaw<
      Array<{ id: string; title: string; url: string; reward: number; active: boolean; createdAt: Date }>
    >`
      SELECT "id","title","url","reward","active","createdAt"
      FROM "AdOffer"
      ORDER BY "createdAt" DESC
      LIMIT 1
    `;
    adOfferLatest = latest[0] || null;

    offers = await prisma.$queryRaw<
      Array<{ id: string; title: string; url: string; reward: number; active: boolean; createdAt: Date }>
    >`
      SELECT "id","title","url","reward","active","createdAt"
      FROM "AdOffer"
      WHERE "active" = true
      ORDER BY "sort" DESC, "createdAt" DESC
    `;
  } catch (e: any) {
    // Если таблицы нет/ошибка — покажем debug админу
    return NextResponse.json(
      {
        ok: false,
        error: "AD_OFFER_QUERY_FAIL",
        ...(isAdmin ? { debug: { message: String(e?.message || e) } } : {}),
      },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }

  // 2) Пытаемся получить userId (если не получилось — всё равно вернём offers, но claimed=false)
  let userId: string | null = null;
  let authError: string | null = null;
  try {
    userId = await requireUserId(req);
  } catch (e: any) {
    userId = null;
    authError = "UNAUTHORIZED";
  }

  // 3) Claimed (только если есть userId)
  let claimedSet = new Set<string>();
  if (userId) {
    try {
      const claimedRows = await prisma.$queryRaw<Array<{ offerId: string }>>`
        SELECT "offerId" AS "offerId"
        FROM "AdClaim"
        WHERE "userId" = ${userId}
      `;
      claimedSet = new Set(claimedRows.map((r) => r.offerId));
    } catch {
      claimedSet = new Set();
    }
  }

  return NextResponse.json(
    {
      ok: true,
      offers: offers.map((o) => ({
        id: o.id,
        title: o.title,
        url: o.url,
        reward: Number(o.reward) || 0,
        claimed: userId ? claimedSet.has(o.id) : false,
      })),
      ...(isAdmin
        ? {
            debug: {
              hasInitDataHeader: !!hInit,
              initDataLen: hInit.length,
              authedUserId: userId,
              authError,
              adOfferCount,
              adOfferActiveCount,
              adOfferLatest,
            },
          }
        : {}),
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
