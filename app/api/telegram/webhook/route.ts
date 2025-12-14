import { NextResponse } from "next/server";
import { tgCall } from "@/lib/telegramBot";
import { prisma } from "@/lib/prisma";
import { SHOP_PACKS, parsePayload } from "@/lib/shop";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SECRET = process.env.TELEGRAM_WEBHOOK_SECRET || "";
const ADMIN_TG_ID = process.env.BOT_ADMIN_TG_ID || "";

function isAdmin(tgId: string | number | undefined | null) {
  if (!ADMIN_TG_ID) return false;
  return String(tgId ?? "") === String(ADMIN_TG_ID);
}

function startOfTodayUtc() {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

async function sendStats(chatId: number) {
  const total = await prisma.user.count();

  const today = startOfTodayUtc();
  const newToday = await prisma.user.count({ where: { createdAt: { gte: today } } });
  const activeToday = await prisma.user.count({ where: { lastSeenAt: { gte: today } } });

  const d30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const active30d = await prisma.user.count({ where: { lastSeenAt: { gte: d30 } } });

  const text =
    `📊 *Daily Tarot — статистика*\n\n` +
    `👥 Всего пользователей: *${total}*\n` +
    `🆕 Новых сегодня: *${newToday}*\n` +
    `🔥 Активных сегодня: *${activeToday}*\n` +
    `📅 Активных за 30 дней: *${active30d}*`;

  await tgCall("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "Markdown",
  });
}

function normalizeCmd(s: string) {
  const first = String(s || "")
    .trim()
    .toLowerCase()
    .replace(/^\/+/, "")
    .split(/\s+/)[0];

  // чтобы /stats@my_bot тоже работал
  return first.split("@")[0];
}

function isStatsCommand(cmd: string) {
  return cmd === "stats" || cmd === "stat" || cmd === "стат" || cmd === "статистика";
}

function appBaseUrl() {
  // 1) лучший вариант — задать APP_URL в env
  if (process.env.APP_URL) return process.env.APP_URL;

  // 2) на Vercel обычно есть VERCEL_URL (без https)
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;

  // 3) запасной (на всякий)
  return "https://taro-hazel.vercel.app";
}

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

  const rows = await prisma.$executeRawUnsafe(
    `
    INSERT INTO "StarsPayment" ("telegramChargeId","userId","packId","stars","coins","payload")
    VALUES ($1,$2,$3,$4,$5,$6)
    ON CONFLICT ("telegramChargeId") DO NOTHING;
  `,
    params.telegramChargeId,
    params.userId,
    params.packId,
    params.stars,
    params.coins,
    params.payload
  );

  return Number(rows) > 0; // 1 если вставили, 0 если уже был
}

export async function POST(req: Request) {
  // проверка secret_token от Telegram setWebhook
  const gotSecret = req.headers.get("x-telegram-bot-api-secret-token") || "";
  if (SECRET && gotSecret !== SECRET) return NextResponse.json({ ok: true });

  const update = await req.json().catch(() => null);
  if (!update) return NextResponse.json({ ok: true });

  // --- callback_query (если “нажал кнопку” в боте) ---
  const cq = update.callback_query;
  if (cq) {
    const fromId = cq.from?.id;
    const chatId = cq.message?.chat?.id;
    const data = normalizeCmd(cq.data || "");

    // убрать “часики” на кнопке
    if (cq.id) {
      await tgCall("answerCallbackQuery", { callback_query_id: cq.id }).catch(() => {});
    }

    // фиксируем активность (если юзер уже есть в БД)
    if (fromId) {
      await prisma.user
        .updateMany({ where: { tgId: String(fromId) }, data: { lastSeenAt: new Date() } })
        .catch(() => {});
    }

    if (chatId && isStatsCommand(data)) {
      if (!isAdmin(fromId)) {
        await tgCall("sendMessage", { chat_id: chatId, text: "⛔️ Команда доступна только администратору." });
        return NextResponse.json({ ok: true });
      }
      await sendStats(chatId);
      return NextResponse.json({ ok: true });
    }
  }

  // --- обычное сообщение ---
  const msg = update.message;
  const text = msg?.text ? String(msg.text) : "";
  const fromId = msg?.from?.id;
  const chatId = msg?.chat?.id;

  // фиксируем активность (если юзер уже есть в БД)
  if (fromId) {
    await prisma.user
      .updateMany({ where: { tgId: String(fromId) }, data: { lastSeenAt: new Date() } })
      .catch(() => {});
  }

  if (text && chatId) {
    const cmd = normalizeCmd(text);

    // ✅ /start — приветствие + фото + кнопка открыть mini app
    if (cmd === "start") {
      const base = appBaseUrl();
      const caption =
        "✨ Добро пожаловать в «Карта Дня | Daily Tarot»\n\n" +
        "Здесь всё просто и приятно:\n" +
        "— Карта дня (общая для всех) — смысл и мягкий совет.\n" +
        "— Колесо фортуны — 1 раз в сутки: одна карта, один знак.\n" +
        "— Расклады — когда нужен ответ глубже (всё сохраняется в архиве).\n\n" +
        "🎁 На старте у тебя уже есть 250 валюты — хватит, чтобы попробовать первые расклады.\n" +
        "Нажми кнопку ниже и открой свою первую подсказку.";

      await tgCall("sendPhoto", {
        chat_id: chatId,
        photo: `${base}/logo.png`,
        caption,
        reply_markup: {
          inline_keyboard: [[{ text: "Открыть приложение", web_app: { url: base } }]],
        },
      });

      return NextResponse.json({ ok: true });
    }

    // ✅ /stats
    if (isStatsCommand(cmd)) {
      if (!isAdmin(fromId)) {
        await tgCall("sendMessage", { chat_id: chatId, text: "⛔️ Команда доступна только администратору." });
        return NextResponse.json({ ok: true });
      }
      await sendStats(chatId);
      return NextResponse.json({ ok: true });
    }
  }

  // --- pre_checkout_query (Stars) ---
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

  // --- successful_payment (Stars) ---
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
      const u = await prisma.user.update({
        where: { id: parsed.userId },
        data: { balance: { increment: pack.coins }, lastSeenAt: new Date() },
        select: { balance: true },
      });

      // чтобы пользователь видел, что начислилось
      if (chatId) {
        await tgCall("sendMessage", {
          chat_id: chatId,
          text: `✨ Начислено: +${pack.coins} валюты.\nТекущий баланс: ${u.balance}`,
        });
      }
    }

    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: true });
}
