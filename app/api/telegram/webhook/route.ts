import { NextResponse } from "next/server";
import { tgCall } from "@/lib/telegramBot";
import { prisma } from "@/lib/prisma";
import { SHOP_PACKS, parsePayload } from "@/lib/shop";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SECRET = process.env.TELEGRAM_WEBHOOK_SECRET || "";
const APP_URL = process.env.APP_URL || "";
const ADMIN_TG_ID = Number(process.env.ADMIN_TG_ID || "0");

async function ensurePaymentsTable() {
  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS "StarsPayment" (
      "telegramChargeId" TEXT PRIMARY KEY,
      "userId" TEXT NOT NULL,
      "packId" TEXT NOT NULL,
      "stars" INTEGER NOT NULL,
      "coins" INTEGER NOT NULL,
      "payload" TEXT NOT NULL,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `;
  await prisma.$executeRaw`
    CREATE INDEX IF NOT EXISTS "StarsPayment_userId_idx" ON "StarsPayment" ("userId");
  `;
}

async function ensureAdsTable() {
  await prisma.$executeRaw`
    CREATE TABLE IF NOT EXISTS "AdvertiserChannel" (
      "id"        text PRIMARY KEY DEFAULT gen_random_uuid()::text,
      "username"  text NOT NULL UNIQUE,
      "title"     text NOT NULL,
      "isActive"  boolean NOT NULL DEFAULT true,
      "sort"      integer NOT NULL DEFAULT 0,
      "createdAt" timestamptz NOT NULL DEFAULT now()
    );
  `;
  await prisma.$executeRaw`
    CREATE INDEX IF NOT EXISTS "AdvertiserChannel_isActive_sort_idx"
    ON "AdvertiserChannel" ("isActive","sort","createdAt");
  `;
}

async function markPaymentProcessed(params: {
  telegramChargeId: string;
  userId: string;
  packId: string;
  stars: number;
  coins: number;
  payload: string;
}) {
  await ensurePaymentsTable();

  const inserted = (await prisma.$queryRaw`
    INSERT INTO "StarsPayment" ("telegramChargeId","userId","packId","stars","coins","payload")
    VALUES (${params.telegramChargeId}, ${params.userId}, ${params.packId}, ${params.stars}, ${params.coins}, ${params.payload})
    ON CONFLICT ("telegramChargeId") DO NOTHING
    RETURNING "telegramChargeId";
  `) as any[];

  return inserted.length > 0;
}

function kbWebAppRow(url: string) {
  return {
    inline_keyboard: [
      [
        { text: "✨ Посмотреть карту дня", web_app: { url: url ? `${url}?from=start&daily=1` : "https://t.me" } },
        { text: "Открыть приложение", web_app: { url: url || "https://t.me" } },
      ],
    ],
  };
}

async function sendWelcome(chatId: number) {
  const text =
    "✨ Добро пожаловать в «Карта Дня | Daily Tarot»\n\n" +
    "Каждый день здесь тебя ждёт знак судьбы — карта дня и мистические подсказки.\n" +
    "А ещё: колесо фортуны и расклады, которые мягко подсветят путь.\n\n" +
    "Нажми ниже — и открой свою карту 💛";

  // если APP_URL настроен — шлём фото (public/logo.png), иначе просто текст
  if (APP_URL) {
    await tgCall("sendPhoto", {
      chat_id: chatId,
      photo: `${APP_URL}/logo.png`,
      caption: text,
      reply_markup: kbWebAppRow(APP_URL),
    });
  } else {
    await tgCall("sendMessage", {
      chat_id: chatId,
      text,
      reply_markup: kbWebAppRow(""),
    });
  }
}

async function isAdmin(update: any) {
  const fromId = update?.message?.from?.id ?? update?.callback_query?.from?.id ?? 0;
  return ADMIN_TG_ID > 0 && Number(fromId) === ADMIN_TG_ID;
}

async function handleAdminCommands(update: any) {
  const msg = update?.message;
  if (!msg?.text) return false;
  if (msg?.chat?.type !== "private") return false;
  if (!(await isAdmin(update))) return false;

  const chatId = msg.chat.id as number;
  const text = String(msg.text || "").trim();
  const [cmdRaw, arg1, arg2] = text.split(/\s+/);
  const cmd = String(cmdRaw || "").toLowerCase();

  const normUser = (s?: string) => String(s || "").replace(/^@/, "").trim();

  if (cmd === "/ads") {
    await ensureAdsTable();
    const rows = (await prisma.$queryRaw`
      SELECT "username","title","isActive","sort"
      FROM "AdvertiserChannel"
      ORDER BY "isActive" DESC, "sort" ASC, "createdAt" DESC
      LIMIT 50;
    `) as any[];

    const lines = rows.map((r) => `${r.isActive ? "✅" : "⛔️"} @${r.username} — ${r.title} (sort=${r.sort})`);
    await tgCall("sendMessage", {
      chat_id: chatId,
      text: lines.length ? `Каналы:\n\n${lines.join("\n")}` : "Список пуст.",
    });
    return true;
  }

  if (cmd === "/addad") {
    const u = normUser(arg1);
    if (!u) {
      await tgCall("sendMessage", { chat_id: chatId, text: "Используй: /addad @channel" });
      return true;
    }

    await ensureAdsTable();

    // пытаемся взять красивое название через getChat
    let title = u;
    try {
      const resp = await tgCall("getChat", { chat_id: `@${u}` });
      const r = resp?.result ?? resp;
      title = String(r?.title || r?.username || u);
    } catch {}

    const sort = Number(arg2);
    const sortVal = Number.isFinite(sort) ? sort : 0;

    await prisma.$executeRaw`
      INSERT INTO "AdvertiserChannel" ("username","title","isActive","sort")
      VALUES (${u}, ${title}, true, ${sortVal})
      ON CONFLICT ("username") DO UPDATE
      SET "title" = EXCLUDED."title",
          "isActive" = true,
          "sort" = EXCLUDED."sort";
    `;

    await tgCall("sendMessage", { chat_id: chatId, text: `✅ Добавил: @${u}\nНазвание: ${title}\nsort=${sortVal}` });
    return true;
  }

  if (cmd === "/delad") {
    const u = normUser(arg1);
    if (!u) {
      await tgCall("sendMessage", { chat_id: chatId, text: "Используй: /delad @channel" });
      return true;
    }

    await ensureAdsTable();
    await prisma.$executeRaw`UPDATE "AdvertiserChannel" SET "isActive" = false WHERE "username" = ${u};`;
    await tgCall("sendMessage", { chat_id: chatId, text: `⛔️ Выключил: @${u}` });
    return true;
  }

  if (cmd === "/stats") {
    // статистика только для админа
    try {
      const total = (await prisma.$queryRaw`SELECT COUNT(*)::int AS c FROM "User";`) as any[];
      const todayNew = (await prisma.$queryRaw`
        SELECT COUNT(*)::int AS c
        FROM "User"
        WHERE "createdAt" >= date_trunc('day', now());
      `) as any[];

      // lastSeenAt может быть, а может нет — если нет, просто не упадём
      let todayActive: any[] = [];
      let m30: any[] = [];
      try {
        todayActive = (await prisma.$queryRaw`
          SELECT COUNT(*)::int AS c
          FROM "User"
          WHERE "lastSeenAt" >= date_trunc('day', now());
        `) as any[];
        m30 = (await prisma.$queryRaw`
          SELECT COUNT(*)::int AS c
          FROM "User"
          WHERE "lastSeenAt" >= now() - interval '30 days';
        `) as any[];
      } catch {}

      const t = total?.[0]?.c ?? 0;
      const n = todayNew?.[0]?.c ?? 0;
      const a = todayActive?.[0]?.c ?? "—";
      const m = m30?.[0]?.c ?? "—";

      await tgCall("sendMessage", {
        chat_id: chatId,
        text: `📊 Статистика\n\nВсего пользователей: ${t}\nНовых сегодня: ${n}\nАктивных сегодня: ${a}\nАктивных за 30 дней: ${m}`,
      });
    } catch {
      await tgCall("sendMessage", { chat_id: chatId, text: "Не удалось получить статистику." });
    }
    return true;
  }

  await tgCall("sendMessage", {
    chat_id: chatId,
    text: "Команды:\n/addad @channel [sort]\n/delad @channel\n/ads\n/stats",
  });
  return true;
}

export async function POST(req: Request) {
  const gotSecret = req.headers.get("x-telegram-bot-api-secret-token") || "";
  if (SECRET && gotSecret !== SECRET) {
    return NextResponse.json({ ok: true });
  }

  const update = await req.json().catch(() => null);
  if (!update) return NextResponse.json({ ok: true });

  // админ-команды (в приоритете)
  try {
    const handled = await handleAdminCommands(update);
    if (handled) return NextResponse.json({ ok: true });
  } catch {}

  // /start приветствие
  try {
    const msg = update.message;
    const text = String(msg?.text || "");
    if (msg?.chat?.type === "private" && text.startsWith("/start")) {
      await sendWelcome(msg.chat.id);
      return NextResponse.json({ ok: true });
    }
  } catch {}

  // 1) pre_checkout_query — обязаны ответить быстро
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

    const pack = (SHOP_PACKS as any)[parsed.packId];
    const ok = q.currency === "XTR" && Number(q.total_amount) === Number(pack?.stars || 0);

    await tgCall("answerPreCheckoutQuery", {
      pre_checkout_query_id: q.id,
      ok,
      ...(ok ? {} : { error_message: "Сумма платежа не совпала. Попробуй ещё раз." }),
    });

    return NextResponse.json({ ok: true });
  }

  // 2) successful_payment — начисляем валюту
  const msg = update.message;
  const sp = msg?.successful_payment;

  if (sp) {
    const payload = String(sp.invoice_payload || "");
    const parsed = parsePayload(payload);
    if (!parsed) return NextResponse.json({ ok: true });

    const pack = (SHOP_PACKS as any)[parsed.packId];
    if (!pack) return NextResponse.json({ ok: true });

    if (sp.currency !== "XTR") return NextResponse.json({ ok: true });
    if (Number(sp.total_amount) !== Number(pack.stars)) return NextResponse.json({ ok: true });

    const telegramChargeId = String(sp.telegram_payment_charge_id || "");
    if (!telegramChargeId) return NextResponse.json({ ok: true });

    try {
      const inserted = await markPaymentProcessed({
        telegramChargeId,
        userId: parsed.userId,
        packId: parsed.packId,
        stars: Number(pack.stars),
        coins: Number(pack.coins),
        payload,
      });

      if (inserted) {
        await prisma.user.update({
          where: { id: parsed.userId },
          data: { balance: { increment: Number(pack.coins) } },
        });

        // опционально: подтверждение в чат
        try {
          await tgCall("sendMessage", {
            chat_id: msg.chat.id,
            text: `✨ Начислено +${pack.coins} валюты. Приятных раскладов!`,
            reply_markup: kbWebAppRow(APP_URL),
          });
        } catch {}
      }
    } catch {
      // не падаем — Telegram всё равно ждёт 200 OK
    }
  }

  return NextResponse.json({ ok: true });
}
