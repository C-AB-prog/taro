import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { tgCall } from "@/lib/telegramBot";
import { SHOP_PACKS, parsePayload } from "@/lib/shop";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SECRET = process.env.TELEGRAM_WEBHOOK_SECRET || "";
const APP_URL = (process.env.APP_URL || "").replace(/\/+$/, ""); // https://taro-hazel.vercel.app
const ADMIN_TG_IDS = (process.env.ADMIN_TG_IDS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

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

/* ================== Stars payments ================== */

async function ensurePaymentsTable() {
  try {
    await prisma.$executeRawUnsafe(`CREATE EXTENSION IF NOT EXISTS pgcrypto;`);
  } catch {}

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
    ON CONFLICT ("telegramChargeId") DO NOTHING;
  `;

  return Number(rows) > 0;
}

/* ================== Ad offers ================== */

async function ensureOffersTables() {
  try {
    await prisma.$executeRawUnsafe(`CREATE EXTENSION IF NOT EXISTS pgcrypto;`);
  } catch {}

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

  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "AdOffer_active_idx" ON "AdOffer" ("active");`);
}

/* ================== Referral pending (через /start ref_...) ================== */

async function ensureReferralTables() {
  try {
    await prisma.$executeRawUnsafe(`CREATE EXTENSION IF NOT EXISTS pgcrypto;`);
  } catch {}

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "ReferralPending" (
      "tgId" TEXT PRIMARY KEY,
      "referrerUserId" TEXT NOT NULL,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
}

async function rememberReferralPending(tgId: string, referrerUserId: string) {
  await ensureReferralTables();

  // referrer должен существовать, иначе не сохраняем
  const refExists = await prisma.user.findUnique({ where: { id: referrerUserId }, select: { id: true } });
  if (!refExists) return;

  await prisma.$executeRaw`
    INSERT INTO "ReferralPending" ("tgId","referrerUserId")
    VALUES (${tgId}, ${referrerUserId})
    ON CONFLICT ("tgId") DO UPDATE
    SET "referrerUserId" = EXCLUDED."referrerUserId",
        "createdAt" = now()
  `;
}

/* ================== Stats ================== */

async function ensureUserStatsCols() {
  try {
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "User"
      ADD COLUMN IF NOT EXISTS "lastSeenAt" timestamptz NOT NULL DEFAULT now();
    `);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "User_lastSeenAt_idx" ON "User" ("lastSeenAt");`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "User_createdAt_idx" ON "User" ("createdAt");`);
  } catch {}
}

async function getStats() {
  await ensureUserStatsCols();

  const total = await prisma.$queryRawUnsafe<any[]>(`SELECT COUNT(*)::int AS c FROM "User";`);
  const todayNew = await prisma.$queryRawUnsafe<any[]>(
    `SELECT COUNT(*)::int AS c FROM "User" WHERE "createdAt" >= date_trunc('day', now());`
  );
  const todayActive = await prisma.$queryRawUnsafe<any[]>(
    `SELECT COUNT(*)::int AS c FROM "User" WHERE "lastSeenAt" >= date_trunc('day', now());`
  );
  const m30 = await prisma.$queryRawUnsafe<any[]>(
    `SELECT COUNT(*)::int AS c FROM "User" WHERE "lastSeenAt" >= now() - interval '30 days';`
  );

  return {
    total: Number(total?.[0]?.c || 0),
    todayNew: Number(todayNew?.[0]?.c || 0),
    todayActive: Number(todayActive?.[0]?.c || 0),
    m30: Number(m30?.[0]?.c || 0),
  };
}

/* ================== Welcome ================== */

async function sendWelcome(chatId: number) {
  const text =
    `✨ Добро пожаловать в «Карта Дня | Daily Tarot»\n\n` +
    `• Карта дня — общий знак для всех\n` +
    `• Колесо фортуны — 1 раз в сутки\n` +
    `• Расклады — с трактовкой\n\n` +
    `Открывай приложение кнопкой ниже 👇`;

  const kb =
    APP_URL
      ? { inline_keyboard: [[{ text: "Посмотреть карту дня", web_app: { url: APP_URL } }]] }
      : undefined;

  // фото: положи в public/logo.png
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

/* ================== Webhook ================== */

export async function POST(req: Request) {
  const gotSecret = req.headers.get("x-telegram-bot-api-secret-token") || "";
  if (SECRET && gotSecret !== SECRET) return NextResponse.json({ ok: true });

  const update = await req.json().catch(() => null);
  if (!update) return NextResponse.json({ ok: true });

  // 1) pre_checkout_query (Stars)
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

    const pack = SHOP_PACKS[parsed.packId];
    const ok = q.currency === "XTR" && Number(q.total_amount) === pack.stars;

    await tgCall("answerPreCheckoutQuery", {
      pre_checkout_query_id: q.id,
      ok,
      ...(ok ? {} : { error_message: "Сумма платежа не совпала. Попробуй ещё раз." }),
    });

    return NextResponse.json({ ok: true });
  }

  // 2) successful_payment (Stars)
  const msg = update.message || update.edited_message;
  const sp = msg?.successful_payment;

  if (sp) {
    const payload = String(sp.invoice_payload || "");
    const parsed = parsePayload(payload);
    if (!parsed) return NextResponse.json({ ok: true });

    const pack = SHOP_PACKS[parsed.packId];

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
          text: `Готово ✨ Начислено +${pack.coins} валюты.`,
        });
      } catch {}
    }

    return NextResponse.json({ ok: true });
  }

  // 3) команды
  const text = String(msg?.text || "").trim();
  if (msg?.chat?.id && text.startsWith("/")) {
    const chatId = Number(msg.chat.id);
    const fromId = msg?.from?.id ? Number(msg.from.id) : null;
    const { cmd, args } = normCmd(text);

    if (cmd === "/start") {
      // ✅ ловим /start ref_<userId> и сохраняем ожидание
      const a = String(args || "").trim();
      if (fromId && a.startsWith("ref_")) {
        const referrerUserId = a.slice(4).trim();
        if (referrerUserId) {
          try {
            await rememberReferralPending(String(fromId), referrerUserId);
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

      // формат: /addad Название | https://t.me/channel | 100
      const raw = String(args || "");
      const parts = raw.split("|").map((s) => s.trim()).filter(Boolean);

      const title = parts[0] || "";
      const url = normalizeTgUrl(parts[1] || "");
      const reward = Number(parts[2] || 100);

      if (!title || !url) {
        await tgCall("sendMessage", { chat_id: chatId, text: `Формат:\n/addad Название | https://t.me/channel | 100` });
        return NextResponse.json({ ok: true });
      }
      if (!Number.isFinite(reward) || reward <= 0 || reward > 100000) {
        await tgCall("sendMessage", { chat_id: chatId, text: "Неверная награда (reward)." });
        return NextResponse.json({ ok: true });
      }

      await ensureOffersTables();

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
        text: `✅ Добавлено/обновлено:\n${title}\n${url}\nБонус: +${reward}`,
      });

      return NextResponse.json({ ok: true });
    }

    if (cmd === "/delad") {
      if (!isAdmin(fromId)) {
        await tgCall("sendMessage", { chat_id: chatId, text: "Команда доступна только админу." });
        return NextResponse.json({ ok: true });
      }

      const target = String(args || "").trim();
      if (!target) {
        await tgCall("sendMessage", {
          chat_id: chatId,
          text: `Формат:\n/delad https://t.me/channel\nили\n/delad <offerId>`,
        });
        return NextResponse.json({ ok: true });
      }

      await ensureOffersTables();

      const looksUrl =
        target.startsWith("http://") ||
        target.startsWith("https://") ||
        target.startsWith("@") ||
        target.includes("t.me/");

      let updated = 0;

      if (looksUrl) {
        const url = normalizeTgUrl(target);
        const rows = await prisma.$executeRaw`
          UPDATE "AdOffer" SET "active" = false WHERE "url" = ${url}
        `;
        updated = Number(rows) || 0;
      } else {
        const rows = await prisma.$executeRaw`
          UPDATE "AdOffer" SET "active" = false WHERE "id" = ${target}
        `;
        updated = Number(rows) || 0;
      }

      await tgCall("sendMessage", {
        chat_id: chatId,
        text: updated > 0 ? "✅ Удалено (выключено)." : "Не нашёл такой оффер.",
      });

      return NextResponse.json({ ok: true });
    }

    await tgCall("sendMessage", { chat_id: chatId, text: "Не понял команду. Доступно: /start /stat /addad /delad" });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: true });
}
