import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { tgCall } from "@/lib/telegramBot";
import { SHOP_PACKS, parsePayload } from "@/lib/shop";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SECRET = process.env.TELEGRAM_WEBHOOK_SECRET || "";
const APP_URL = (process.env.APP_URL || "").replace(/\/+$/, "");
const ADMIN_TG_IDS = (process.env.ADMIN_TG_IDS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

/* ================= utils ================= */

function isAdmin(tgId?: number | string | null) {
  if (!tgId) return false;
  return ADMIN_TG_IDS.includes(String(tgId));
}

function normCmd(text: string) {
  const t = String(text || "").trim();
  if (!t.startsWith("/")) return { cmd: "", args: "" };
  const first = t.split(/\s+/)[0] || "";
  const cmd = first.split("@")[0].toLowerCase();
  const args = t.slice(first.length).trim();
  return { cmd, args };
}

/* ================= referral ================= */

async function ensureReferralTables() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "ReferralPending" (
      "inviteeTgId" TEXT PRIMARY KEY,
      "referrerUserId" TEXT NOT NULL,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
}

async function saveReferralPending(inviteeTgId: string, referrerUserId: string) {
  await ensureReferralTables();
  await prisma.$executeRaw`
    INSERT INTO "ReferralPending" ("inviteeTgId","referrerUserId")
    VALUES (${inviteeTgId}, ${referrerUserId})
    ON CONFLICT ("inviteeTgId") DO NOTHING
  `;
}

/* ================= payments ================= */

async function ensurePaymentsTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "StarsPayment" (
      "telegramChargeId" TEXT PRIMARY KEY,
      "userId" TEXT NOT NULL,
      "packId" TEXT NOT NULL,
      "stars" INTEGER NOT NULL,
      "coins" INTEGER NOT NULL,
      "payload" TEXT NOT NULL,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
}

async function markProcessed(params: {
  telegramChargeId: string;
  userId: string;
  packId: string;
  stars: number;
  coins: number;
  payload: string;
}) {
  await ensurePaymentsTable();

  const rows = await prisma.$executeRaw`
    INSERT INTO "StarsPayment"
      ("telegramChargeId","userId","packId","stars","coins","payload")
    VALUES
      (${params.telegramChargeId}, ${params.userId}, ${params.packId},
       ${params.stars}, ${params.coins}, ${params.payload})
    ON CONFLICT ("telegramChargeId") DO NOTHING
  `;

  return Number(rows) > 0;
}

/* ================= webhook ================= */

export async function POST(req: Request) {
  const gotSecret = req.headers.get("x-telegram-bot-api-secret-token") || "";
  if (SECRET && gotSecret !== SECRET) {
    return NextResponse.json({ ok: true });
  }

  const update = await req.json().catch(() => null);
  if (!update) return NextResponse.json({ ok: true });

  /* ===== pre_checkout_query ===== */
  if (update.pre_checkout_query) {
    const q = update.pre_checkout_query;
    const parsed = parsePayload(String(q.invoice_payload || ""));

    if (!parsed) {
      await tgCall("answerPreCheckoutQuery", {
        pre_checkout_query_id: q.id,
        ok: false,
        error_message: "Платёж не распознан",
      });
      return NextResponse.json({ ok: true });
    }

    const pack = SHOP_PACKS[parsed.packId as keyof typeof SHOP_PACKS];

    if (!pack) {
      await tgCall("answerPreCheckoutQuery", {
        pre_checkout_query_id: q.id,
        ok: false,
        error_message: "Пакет не найден",
      });
      return NextResponse.json({ ok: true });
    }

    await tgCall("answerPreCheckoutQuery", {
      pre_checkout_query_id: q.id,
      ok: true,
    });

    return NextResponse.json({ ok: true });
  }

  const msg = update.message;

  /* ===== successful_payment ===== */
  if (msg?.successful_payment) {
    const sp = msg.successful_payment;
    const parsed = parsePayload(String(sp.invoice_payload || ""));
    if (!parsed) return NextResponse.json({ ok: true });

    const pack = SHOP_PACKS[parsed.packId as keyof typeof SHOP_PACKS];
    if (!pack) return NextResponse.json({ ok: true });

    if (sp.currency !== "XTR") return NextResponse.json({ ok: true });
    if (Number(sp.total_amount) !== pack.stars) return NextResponse.json({ ok: true });

    const telegramChargeId = String(sp.telegram_payment_charge_id || "");
    if (!telegramChargeId) return NextResponse.json({ ok: true });

    const inserted = await markProcessed({
      telegramChargeId,
      userId: parsed.userId,
      packId: parsed.packId,
      stars: pack.stars,
      coins: pack.coins,
      payload: String(sp.invoice_payload),
    });

    if (inserted) {
      await prisma.user.update({
        where: { id: parsed.userId },
        data: { balance: { increment: pack.coins } },
      });

      try {
        await tgCall("sendMessage", {
          chat_id: msg.chat.id,
          text: `✨ Начислено +${pack.coins}`,
        });
      } catch {}
    }

    return NextResponse.json({ ok: true });
  }

  /* ===== commands ===== */
  if (msg?.text?.startsWith("/")) {
    const chatId = msg.chat.id;
    const fromId = msg.from?.id;
    const { cmd, args } = normCmd(msg.text);

    if (cmd === "/start") {
      if (fromId && args?.startsWith("ref_")) {
        const referrerUserId = args.slice(4).trim();
        if (referrerUserId) {
          await saveReferralPending(String(fromId), referrerUserId);
        }
      }

      await tgCall("sendMessage", {
        chat_id: chatId,
        text: "✨ Добро пожаловать!\nНажми кнопку ниже 👇",
        reply_markup: APP_URL
          ? {
              inline_keyboard: [
                [{ text: "Открыть приложение", web_app: { url: APP_URL } }],
              ],
            }
          : undefined,
      });

      return NextResponse.json({ ok: true });
    }

    if (cmd === "/stat") {
      if (!isAdmin(fromId)) {
        await tgCall("sendMessage", {
          chat_id: chatId,
          text: "Нет доступа",
        });
        return NextResponse.json({ ok: true });
      }

      const total = await prisma.user.count();
      await tgCall("sendMessage", {
        chat_id: chatId,
        text: `👥 Пользователей: ${total}`,
      });

      return NextResponse.json({ ok: true });
    }
  }

  return NextResponse.json({ ok: true });
}
