import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUserId } from "@/lib/requireUser";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ADMIN_TG_IDS = (process.env.ADMIN_TG_IDS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

async function ensureReferralTables() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "ReferralPending" (
      "inviteeTgId" TEXT PRIMARY KEY,
      "referrerUserId" TEXT NOT NULL,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "ReferralGrant" (
      "inviteeUserId" TEXT PRIMARY KEY,
      "referrerUserId" TEXT NOT NULL,
      "inviteeTgId" TEXT NOT NULL,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
}

export async function GET(req: Request) {
  // авторизация в мини-аппе (сессия)
  let adminUserId = "";
  try {
    adminUserId = await requireUserId(req);
  } catch {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  // проверяем что это админ по tgId
  const admin = await prisma.user.findUnique({
    where: { id: adminUserId },
    select: { tgId: true, id: true },
  });

  if (!admin?.tgId || !ADMIN_TG_IDS.includes(String(admin.tgId))) {
    return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
  }

  await ensureReferralTables();

  const url = new URL(req.url);
  const tgId = String(url.searchParams.get("tgId") || "").trim(); // tgId друга
  if (!tgId) {
    return NextResponse.json(
      {
        ok: false,
        error: "MISSING_TGID",
        hint: "Пример: /api/admin/refcheck?tgId=123456789",
      },
      { status: 400 }
    );
  }

  // есть ли друг в базе (значит он НЕ новый)
  const invitee = await prisma.user.findUnique({
    where: { tgId },
    select: { id: true, tgId: true, createdAt: true },
  });

  const pending = await prisma.$queryRaw<Array<{ referrerUserId: string; createdAt: Date }>>`
    SELECT "referrerUserId","createdAt"
    FROM "ReferralPending"
    WHERE "inviteeTgId" = ${tgId}
    LIMIT 1
  `;

  const grant = await prisma.$queryRaw<Array<{ inviteeUserId: string; referrerUserId: string; createdAt: Date }>>`
    SELECT "inviteeUserId","referrerUserId","createdAt"
    FROM "ReferralGrant"
    WHERE "inviteeTgId" = ${tgId}
    LIMIT 1
  `;

  return NextResponse.json(
    {
      ok: true,
      tgId,
      invitee: invitee
        ? { exists: true, id: invitee.id, createdAt: invitee.createdAt }
        : { exists: false },
      pending: pending[0] ? pending[0] : null,
      grant: grant[0] ? grant[0] : null,
      meaning:
        grant[0]
          ? "✅ Бонус уже выдавался (Grant есть)"
          : invitee
          ? "❌ Друг уже есть в базе (НЕ новый) — по правилам бонус не выдаётся"
          : pending[0]
          ? "⏳ Pending есть, но друг ещё не создался/не прошёл auth"
          : "❌ Нет ни Pending, ни Grant — значит реф-параметр не зафиксирован",
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
