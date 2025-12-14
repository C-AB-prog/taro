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
      "username"  text,
      "url"       text,
      "title"     text NOT NULL,
      "isActive"  boolean NOT NULL DEFAULT true,
      "sort"      integer NOT NULL DEFAULT 0,
      "createdAt" timestamptz NOT NULL DEFAULT now()
    );
  `;

  // добавим колонки если таблица была создана старой версией
  await prisma.$executeRaw`ALTER TABLE "AdvertiserChannel" ADD COLUMN IF NOT EXISTS "url" text;`;
  await prisma.$executeRaw`ALTER TABLE "AdvertiserChannel" ADD COLUMN IF NOT EXISTS "username" text;`;

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

function kbOneWebAppButton(url: string) {
  return {
    inline_keyboard: [
      [{ text: "✨ Посмотреть карту дня", web_app: { url: url || "https://t.me" } }],
    ],
  };
}

async function sendWelcome(chatId: number) {
  const text =
    "✨ Добро пожаловать в «Карта Дня | Daily Tarot»\n\n" +
    "Каждый день — знак судьбы: карта дня, колесо фортуны и расклады.\n" +
    "Мягко, мистически и по делу.\n\n" +
    "Нажми кнопку ниже и открой свою карту 💛";

  if (APP_URL) {
    await tgCall("sendPhoto", {
      chat_id: chatId,
      photo: `${APP_URL}/logo.png`,
      caption: text,
      reply_markup: kbOneWebAppButton(`${APP_URL}?from=start&daily=1`),
    });
  } else {
    await tgCall("sendMessage", {
      chat_id: chatId,
      text,
      reply_markup: kbOneWebAppButton(""),
    });
  }
}

async function isAdmin(update: any) {
  const fromId = update?.message?.from?.id ?? update?.callback_query?.from?.id ?? 0;
  return ADMIN_TG_ID > 0 && Number(fromId) === ADMIN_TG_ID;
}

function normalizeTgUrl(raw: string): string | null {
  const s = String(raw || "").trim();
  if (!s) return null;
  if (s.startsWith("http://") || s.startsWith("https://")) return s;
  if (s.startsWith("@")) return `https://t.me/${s.slice(1)}`;
  // если просто username
  if (/^[a-zA-Z0-9_]{3,}$/.test(s)) return `https://t.me/${s}`;
  return null;
}

function extractUsername(url: string): string | null {
  try {
    const u = new URL(url);
    const p = u.pathname.replace(/^\/+/, "");
    if (!p) return null;
    if (p.startsWith("+") || p.startsWith("c/")) return null;
    return p.split("/")[0] || null;
  } catch {
    return null;
  }
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

  if (cmd === "/ads") {
    await ensureAdsTable();
    const rows = (await prisma.$queryRaw`
      SELECT COALESCE("url",'') AS "url", COALESCE("username",'') AS "username", "title", "isActive", "sort"
      FROM "AdvertiserChannel"
      ORDER BY "isActive" DESC, "sort" ASC, "createdAt" DESC
      LIMIT 50;
    `) as any[];

    const lines = rows.map((r) => {
      const link = r.url || (r.username ? `https://t.me/${r.username}` : "");
      return `${r.isActive ? "✅" : "⛔️"} ${link} — ${r.title} (sort=${r.sort})`;
    });

    await tgCall("sendMessage", { chat_id: chatId, text: lines.length ? `Каналы:\n\n${lines.join("\n")}` : "Список пуст." });
    return true;
  }

  if (cmd === "/addad") {
    const url = normalizeTgUrl(arg1);
    if (!url) {
      await tgCall("sendMessage", { chat_id: chatId, text: "Используй: /addad https://t.me/ChannelName [sort]" });
      return true;
    }

    await ensureAdsTable();

    let title = url;
    try {
      const uname = extractUsername(url);
      if (uname) {
        const resp = await tgCall("getChat", { chat_id: `@${uname}` });
        const r = resp?.result ?? resp;
        title = String(r?.title || r?.username || uname);
      }
    } catch {}

    const sort = Number(arg2);
    const sortVal = Number.isFinite(sort) ? sort : 0;
    const username = extractUsername(url);

    await prisma.$executeRaw`
      INSERT INTO "AdvertiserChannel" ("url","username","title","isActive","sort")
      VALUES (${url}, ${username}, ${title}, true, ${sortVal})
      ON CONFLICT ("url") DO UPDATE
      SET "title" = EXCLUDED."title",
          "username" = EXCLUDED."username",
          "isActive" = true,
          "sort" = EXCLUDED."sort";
    `.catch(async () => {
      // если в таблице нет уникальности по url — просто upsert вручную
      await prisma.$executeRaw`
        UPDATE "AdvertiserChannel"
        SET "title" = ${title}, "username" = ${username}, "isActive" = true, "sort" = ${sortVal}
        WHERE "url" = ${url};
      `;
    });

    await tgCall("sendMessage", { chat_id: chatId, text: `✅ Добавил:\n${url}\nНазвание: ${title}\nsort=${sortVal}` });
    return true;
  }

  if (cmd === "/delad") {
    const url = normalizeTgUrl(arg1);
    if (!url) {
      await tgCall("sendMessage", { chat_id: chatId, text: "Используй: /delad https://t.me/ChannelName" });
      return true;
    }

    await ensureAdsTable();
    await prisma.$executeRaw`UPDATE "AdvertiserChannel" SET "isActive" = false WHERE "url" = ${url};`;
    await tgCall("sendMessage", { chat_id: chatId, text: `⛔️ Выключил:\n${url}` });
    return true;
  }

  await tgCall("sendMessage", {
    chat_id: chatId,
    text: "Команды:\n/addad https://t.me/ChannelName [sort]\n/delad https://t.me/ChannelName\n/ads",
  });
  return true;
}

export async function POST(req: Request) {
  const gotSecret = req.headers.get("x-telegram-bot-api-secret-token") || "";
  if (SECRET && gotSecret !== SECRET) return NextResponse.json({ ok: true });

  const update = await req.json().catch(() => null);
  if (!update) return NextResponse.json({ ok: true });

  // админ-команды
  try {
    const handled = await handleAdminCommands(update);
    if (handled) return NextResponse.json({ ok: true });
  } catch {}

  // /start
  try {
    const msg = update.message;
    const t = String(msg?.text || "");
    if (msg?.chat?.type === "private" && t.startsWith("/start")) {
      await sendWelcome(msg.chat.id);
      return NextResponse.json({ ok: true });
    }
  } catch {}

  // pre_checkout_query
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

  // successful_payment
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

        try {
          await tgCall("sendMessage", {
            chat_id: msg.chat.id,
            text: `✨ Начислено +${pack.coins} валюты. Приятных раскладов!`,
            reply_markup: kbOneWebAppButton(`${APP_URL}?from=paid`),
          });
        } catch {}
      }
    } catch {}
  }

  return NextResponse.json({ ok: true });
}
