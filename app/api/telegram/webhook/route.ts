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

function normalizeTgUrl(input: string) {
  const s = String(input || "").trim();
  if (!s) return "";
  if (s.startsWith("https://") || s.startsWith("http://")) return s;
  if (s.startsWith("t.me/")) return `https://${s}`;
  if (s.startsWith("@")) return `https://t.me/${s.slice(1)}`;
  return s;
}

/* ================= referral pending ================= */

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

  // фикс: не перезаписываем (первый реферер выигрывает)
  await prisma.$executeRaw`
    INSERT INTO "ReferralPending" ("inviteeTgId","referrerUserId")
    VALUES (${inviteeTgId}, ${referrerUserId})
    ON CONFLICT ("inviteeTgId") DO NOTHING
  `;
}

/* ================= Stars payments ================= */

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

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "StarsPayment_userId_idx" ON "StarsPayment" ("userId");
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
    INSERT INTO "StarsPayment" ("telegramChargeId","userId","packId","stars","coins","payload")
    VALUES (${params.telegramChargeId}, ${params.userId}, ${params.packId}, ${params.stars}, ${params.coins}, ${params.payload})
    ON CONFLICT ("telegramChargeId") DO NOTHING
  `;

  return Number(rows) > 0;
}

/* ================= Ads (offers) ================= */

async function ensureOffersTables() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "AdOffer" (
      "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      "title" TEXT NOT NULL,
      "url" TEXT NOT NULL UNIQUE,
      "reward" INTEGER NOT NULL DEFAULT 100,
      "active" BOOLEAN NOT NULL DEFAULT true,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "AdClaim" (
      "userId" TEXT NOT NULL,
      "offerId" TEXT NOT NULL,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY ("userId","offerId")
    );
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "AdOffer_active_idx" ON "AdOffer" ("active");
  `);
}

/* ================= Bot messages ================= */

async function sendWelcome(chatId: number) {
  const text =
    "✨ Добро пожаловать в Daily Tarot!\n\n" +
    "🔮 Здесь ты можешь получать «Карту дня», делать расклады и пополнять баланс.\n\n" +
    "Нажми кнопку ниже, чтобы открыть мини-приложение:";

  const kb = APP_URL
    ? { inline_keyboard: [[{ text: "Открыть приложение", web_app: { url: APP_URL } }]] }
    : undefined;

  // Пытаемся отправить фото из public/logo.png
  if (APP_URL) {
    try {
      await tgCall("sendPhoto", {
        chat_id: chatId,
        photo: `${APP_URL}/logo.png`,
        caption: text,
        reply_markup: kb,
      });
      return;
    } catch {}
  }

  await tgCall("sendMessage", { chat_id: chatId, text, reply_markup: kb });
}

async function getStats() {
  const total = await prisma.user.count();

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const todayNew = await prisma.user.count({ where: { createdAt: { gte: today } } });

  // lastSeenAt может отсутствовать — поэтому try
  let todayActive = 0;
  let m30 = 0;
  try {
    const d30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    todayActive = await prisma.user.count({ where: { lastSeenAt: { gte: today } } as any });
    m30 = await prisma.user.count({ where: { lastSeenAt: { gte: d30 } } as any });
  } catch {}

  return { total, todayNew, todayActive, m30 };
}

/* ================= Webhook ================= */

export async function POST(req: Request) {
  const gotSecret = req.headers.get("x-telegram-bot-api-secret-token") || "";
  if (SECRET && gotSecret !== SECRET) return NextResponse.json({ ok: true });

  const update = await req.json().catch(() => null);
  if (!update) return NextResponse.json({ ok: true });

  /* ===== pre_checkout_query (Stars) ===== */
  if (update.pre_checkout_query) {
    const q = update.pre_checkout_query;
    const payload = String(q.invoice_payload || "");
    const parsed = parsePayload(payload);

    if (!parsed) {
      await tgCall("answerPreCheckoutQuery", {
        pre_checkout_query_id: q.id,
        ok: false,
        error_message: "Платёж не распознан. Попробуй ещё раз.",
      });
      return NextResponse.json({ ok: true });
    }

    const pack = SHOP_PACKS[parsed.packId as keyof typeof SHOP_PACKS];
    if (!pack) {
      await tgCall("answerPreCheckoutQuery", {
        pre_checkout_query_id: q.id,
        ok: false,
        error_message: "Пакет не найден.",
      });
      return NextResponse.json({ ok: true });
    }

    await tgCall("answerPreCheckoutQuery", { pre_checkout_query_id: q.id, ok: true });
    return NextResponse.json({ ok: true });
  }

  const msg = update.message;

  /* ===== successful_payment (Stars) ===== */
  if (msg?.successful_payment) {
    const sp = msg.successful_payment;

    const payload = String(sp.invoice_payload || "");
    const parsed = parsePayload(payload);
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
      payload,
    });

    if (inserted) {
      await prisma.user.update({
        where: { id: parsed.userId },
        data: { balance: { increment: pack.coins } },
      });

      try {
        await tgCall("sendMessage", {
          chat_id: msg.chat.id,
          text: `✅ Начислено +${pack.coins} валюты ✨`,
        });
      } catch {}
    }

    return NextResponse.json({ ok: true });
  }

  /* ===== commands ===== */
  const text = String(msg?.text || "").trim();
  if (msg?.chat?.id && text.startsWith("/")) {
    const chatId = Number(msg.chat.id);
    const fromId = msg?.from?.id ? Number(msg.from.id) : null;
    const { cmd, args } = normCmd(text);

    if (cmd === "/start") {
      // /start ref_<userId>
      const a = String(args || "").trim();
      if (fromId && a.startsWith("ref_")) {
        const referrerUserId = a.slice(4).trim();
        if (referrerUserId) {
          try {
            await saveReferralPending(String(fromId), referrerUserId);
          } catch {}
        }
      }

      await sendWelcome(chatId);
      return NextResponse.json({ ok: true });
    }

    if (cmd === "/stat") {
      if (!isAdmin(fromId)) {
        await tgCall("sendMessage", { chat_id: chatId, text: "Команда доступна только админу." });
        return NextResponse.json({ ok: true });
      }

      const s = await getStats();
      await tgCall("sendMessage", {
        chat_id: chatId,
        text:
          `📊 Статистика\n\n` +
          `Всего пользователей: ${s.total}\n` +
          `Новых сегодня: ${s.todayNew}\n` +
          `Активных сегодня: ${s.todayActive}\n` +
          `Активных за 30 дней: ${s.m30}`,
      });
      return NextResponse.json({ ok: true });
    }

    if (cmd === "/addad") {
      if (!isAdmin(fromId)) {
        await tgCall("sendMessage", { chat_id: chatId, text: "Команда доступна только админу." });
        return NextResponse.json({ ok: true });
      }

      await ensureOffersTables();

      // формат: /addad Название | @username или https://t.me/... | 100
      const raw = String(args || "");
      const parts = raw.split("|").map((s) => s.trim()).filter(Boolean);
      const title = parts[0] || "";
      const url = normalizeTgUrl(parts[1] || "");
      const reward = Math.max(1, Number(parts[2] || "100") || 100);

      if (!title || !url) {
        await tgCall("sendMessage", {
          chat_id: chatId,
          text: "Формат:\n/addad Название | @username/https://t.me/... | 100",
        });
        return NextResponse.json({ ok: true });
      }

      await prisma.$executeRaw`
        INSERT INTO "AdOffer" ("title","url","reward","active")
        VALUES (${title}, ${url}, ${reward}, true)
        ON CONFLICT ("url") DO UPDATE
          SET "title" = EXCLUDED."title",
              "reward" = EXCLUDED."reward",
              "active" = true
      `;

      await tgCall("sendMessage", {
        chat_id: chatId,
        text: `✅ Добавлено:\n${title}\n${url}\nБонус: +${reward}`,
      });
      return NextResponse.json({ ok: true });
    }

    if (cmd === "/delad") {
      if (!isAdmin(fromId)) {
        await tgCall("sendMessage", { chat_id: chatId, text: "Команда доступна только админу." });
        return NextResponse.json({ ok: true });
      }

      await ensureOffersTables();

      // формат: /delad <url или id>
      const target = String(args || "").trim();
      if (!target) {
        await tgCall("sendMessage", { chat_id: chatId, text: "Формат:\n/delad <url или id>" });
        return NextResponse.json({ ok: true });
      }

      // сначала пробуем по id
      const r1 = await prisma.$executeRaw`
        UPDATE "AdOffer" SET "active" = false
        WHERE "id" = ${target}
      `;

      if (Number(r1) <= 0) {
        const url = normalizeTgUrl(target);
        const r2 = await prisma.$executeRaw`
          UPDATE "AdOffer" SET "active" = false
          WHERE "url" = ${url}
        `;
        if (Number(r2) <= 0) {
          await tgCall("sendMessage", { chat_id: chatId, text: "Не найдено." });
          return NextResponse.json({ ok: true });
        }
      }

      await tgCall("sendMessage", { chat_id: chatId, text: "✅ Удалено (выключено)." });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: true });
}
