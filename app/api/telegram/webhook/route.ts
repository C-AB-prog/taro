import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { tgCall } from "@/lib/telegramBot";
import { SHOP_PACKS, parsePayload } from "@/lib/shop";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SECRET = process.env.TELEGRAM_WEBHOOK_SECRET || "";
const APP_URL = (process.env.APP_URL || "").replace(/\/+$/, "");

const ADMIN_IDS = (process.env.ADMIN_TG_IDS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

function isAdmin(tgId: any) {
  return ADMIN_IDS.includes(String(tgId));
}

async function ensureBotTables() {
  // состояние диалога для админ-режима
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "BotState" (
      "tgId" TEXT PRIMARY KEY,
      "state" TEXT NOT NULL,
      "dataText" TEXT NOT NULL DEFAULT '{}',
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  // рекламодатели
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "AdvertiserChannel" (
      "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      "url" TEXT NOT NULL UNIQUE,
      "username" TEXT,
      "title" TEXT NOT NULL,
      "photoFileId" TEXT,
      "reward" INTEGER NOT NULL DEFAULT 100,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);

  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "AdvertiserChannel_createdAt_idx"
    ON "AdvertiserChannel" ("createdAt");
  `);
}

async function getState(tgId: string) {
  await ensureBotTables();
  const rows = await prisma.$queryRawUnsafe<any[]>(
    `SELECT "state","dataText" FROM "BotState" WHERE "tgId"='${tgId}' LIMIT 1`
  );
  const row = rows?.[0];
  if (!row) return null;
  let data: any = {};
  try {
    data = JSON.parse(row.dataText || "{}");
  } catch {}
  return { state: String(row.state), data };
}

async function setState(tgId: string, state: string, data: any = {}) {
  await ensureBotTables();
  const dataText = JSON.stringify(data ?? {});
  await prisma.$executeRawUnsafe(`
    INSERT INTO "BotState" ("tgId","state","dataText")
    VALUES ('${tgId}', '${state}', '${dataText.replace(/'/g, "''")}')
    ON CONFLICT ("tgId") DO UPDATE
    SET "state"=EXCLUDED."state", "dataText"=EXCLUDED."dataText", "updatedAt"=now();
  `);
}

async function clearState(tgId: string) {
  await ensureBotTables();
  await prisma.$executeRawUnsafe(`DELETE FROM "BotState" WHERE "tgId"='${tgId}'`);
}

function parseTmeLink(input: string): { url: string; username?: string } | null {
  const s = String(input || "").trim();
  if (!s) return null;

  // принимаем https://t.me/xxx или http://t.me/xxx
  const m1 = s.match(/https?:\/\/t\.me\/([A-Za-z0-9_]{4,})/i);
  if (m1) return { url: `https://t.me/${m1[1]}`, username: m1[1] };

  // принимаем @xxx
  const m2 = s.match(/^@([A-Za-z0-9_]{4,})$/);
  if (m2) return { url: `https://t.me/${m2[1]}`, username: m2[1] };

  return null;
}

async function sendWelcome(chatId: number) {
  const caption =
    "✨ Добро пожаловать в «Карта Дня | Daily Tarot»\n\n" +
    "Каждый день — одна общая карта для всех.\n" +
    "А ещё есть Колесо Фортуны и расклады, которые помогают мягко разобраться в ситуации.\n\n" +
    "Нажми кнопку ниже — и откроем твою карту.";

  // ⚠️ просили: в приветствии должна быть только ОДНА ссылка/кнопка
  const keyboard = {
    inline_keyboard: [
      [
        {
          text: "Посмотреть карту дня",
          web_app: { url: APP_URL || "https://t.me" },
        },
      ],
    ],
  };

  if (APP_URL) {
    // шлём картинку с твоего домена
    await tgCall("sendPhoto", {
      chat_id: chatId,
      photo: `${APP_URL}/logo.png`,
      caption,
      reply_markup: keyboard,
    });
  } else {
    await tgCall("sendMessage", {
      chat_id: chatId,
      text: caption,
      reply_markup: keyboard,
      disable_web_page_preview: true,
    });
  }
}

async function sendStat(chatId: number) {
  // твои индексы/колонки уже добавлены: createdAt/lastSeenAt
  const total = await prisma.user.count().catch(() => 0);

  const rows1 = await prisma.$queryRawUnsafe<any[]>(
    `SELECT COUNT(*)::int AS c FROM "User" WHERE "createdAt" >= date_trunc('day', now())`
  );
  const todayNew = Number(rows1?.[0]?.c ?? 0);

  const rows2 = await prisma.$queryRawUnsafe<any[]>(
    `SELECT COUNT(*)::int AS c FROM "User" WHERE "lastSeenAt" >= date_trunc('day', now())`
  );
  const activeToday = Number(rows2?.[0]?.c ?? 0);

  const rows3 = await prisma.$queryRawUnsafe<any[]>(
    `SELECT COUNT(*)::int AS c FROM "User" WHERE "lastSeenAt" >= now() - interval '30 days'`
  );
  const active30 = Number(rows3?.[0]?.c ?? 0);

  const text =
    "📊 Статистика\n\n" +
    `Всего пользователей: ${total}\n` +
    `Новых сегодня: ${todayNew}\n` +
    `Активных сегодня: ${activeToday}\n` +
    `Активных за 30 дней: ${active30}`;

  await tgCall("sendMessage", { chat_id: chatId, text });
}

async function upsertAdvertiserByUrl(params: {
  url: string;
  username?: string | null;
  title: string;
  photoFileId?: string | null;
  reward: number;
}) {
  await ensureBotTables();

  const url = params.url.replace(/'/g, "''");
  const username = (params.username || "").replace(/'/g, "''");
  const title = (params.title || "").replace(/'/g, "''");
  const photo = (params.photoFileId || "").replace(/'/g, "''");
  const reward = Number(params.reward || 100);

  await prisma.$executeRawUnsafe(`
    INSERT INTO "AdvertiserChannel" ("url","username","title","photoFileId","reward")
    VALUES ('${url}', ${username ? `'${username}'` : "NULL"}, '${title}', ${photo ? `'${photo}'` : "NULL"}, ${reward})
    ON CONFLICT ("url") DO UPDATE
    SET "username"=EXCLUDED."username",
        "title"=EXCLUDED."title",
        "photoFileId"=EXCLUDED."photoFileId",
        "reward"=EXCLUDED."reward";
  `);
}

async function listAdsText() {
  await ensureBotTables();
  const rows = await prisma.$queryRawUnsafe<any[]>(
    `SELECT "title","url","reward" FROM "AdvertiserChannel" ORDER BY "createdAt" DESC LIMIT 30`
  );

  if (!rows?.length) return "Пока нет рекламодателей.";

  let t = "📣 Рекламодатели в приложении:\n\n";
  rows.forEach((r, idx) => {
    t += `${idx + 1}) ${r.title}\n${r.url}\nБонус: +${r.reward}\n\n`;
  });
  return t.trim();
}

async function deleteAdByUrl(url: string) {
  await ensureBotTables();
  const u = url.replace(/'/g, "''");
  await prisma.$executeRawUnsafe(`DELETE FROM "AdvertiserChannel" WHERE "url"='${u}'`);
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

  const q = `
    INSERT INTO "StarsPayment" ("telegramChargeId","userId","packId","stars","coins","payload")
    VALUES ($1,$2,$3,$4,$5,$6)
    ON CONFLICT ("telegramChargeId") DO NOTHING;
  `;

  // Prisma параметризированный вариант через $executeRawUnsafe тут сложнее,
  // поэтому делаем безопасно простым экранированием для payload (у нас payload наш).
  const rows = await prisma.$executeRawUnsafe(`
    INSERT INTO "StarsPayment" ("telegramChargeId","userId","packId","stars","coins","payload")
    VALUES ('${params.telegramChargeId.replace(/'/g, "''")}',
            '${params.userId.replace(/'/g, "''")}',
            '${params.packId.replace(/'/g, "''")}',
            ${params.stars},
            ${params.coins},
            '${params.payload.replace(/'/g, "''")}')
    ON CONFLICT ("telegramChargeId") DO NOTHING;
  `);

  return Number(rows) > 0;
}

export async function POST(req: Request) {
  // secret_token проверка
  const gotSecret = req.headers.get("x-telegram-bot-api-secret-token") || "";
  if (SECRET && gotSecret !== SECRET) {
    return NextResponse.json({ ok: true });
  }

  const update = await req.json().catch(() => null);
  if (!update) return NextResponse.json({ ok: true });

  // ====== 1) Payments: pre_checkout_query ======
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

  // ====== 2) Payments: successful_payment ======
  const msg = update.message;
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

      // необязательно, но приятно
      try {
        await tgCall("sendMessage", {
          chat_id: msg.chat.id,
          text: `✨ Начислено +${pack.coins} валюты. Спасибо!`,
        });
      } catch {}
    }

    return NextResponse.json({ ok: true });
  }

  // ====== 3) Обычные сообщения: /start, /stat, добавление рекламодателей ======
  if (msg?.text) {
    const chatId = Number(msg.chat?.id);
    const fromId = msg.from?.id;

    const text = String(msg.text || "").trim();

    // /start — приветствие
    if (text.startsWith("/start")) {
      await sendWelcome(chatId);
      return NextResponse.json({ ok: true });
    }

    // /stat — только админ
    if (text === "/stat" || text === "стат" || text === "Стат") {
      if (!isAdmin(fromId)) {
        await tgCall("sendMessage", { chat_id: chatId, text: "Команда доступна только администратору." });
      } else {
        await sendStat(chatId);
      }
      return NextResponse.json({ ok: true });
    }

    // ===== Админ: управление рекламодателями (через диалог) =====
    if (isAdmin(fromId)) {
      const tgId = String(fromId);

      // команды
      if (text === "/addad" || text === "Добавить рекламодателя") {
        await setState(tgId, "await_ad_url", {});
        await tgCall("sendMessage", {
          chat_id: chatId,
          text: "Ок! Пришли ссылку на канал рекламодателя (пример: https://t.me/CodeAdsBusiness).",
        });
        return NextResponse.json({ ok: true });
      }

      if (text === "/ads" || text === "Список рекламодателей") {
        const t = await listAdsText();
        await tgCall("sendMessage", { chat_id: chatId, text: t, disable_web_page_preview: true });
        return NextResponse.json({ ok: true });
      }

      if (text.startsWith("/delad")) {
        const arg = text.replace("/delad", "").trim();
        const parsed = parseTmeLink(arg);
        if (!parsed) {
          await tgCall("sendMessage", {
            chat_id: chatId,
            text: "Пришли ссылку на канал для удаления. Пример:\n/delad https://t.me/SomeChannel",
          });
          return NextResponse.json({ ok: true });
        }

        await deleteAdByUrl(parsed.url);
        await tgCall("sendMessage", { chat_id: chatId, text: "Удалил. (Если был в списке)" });
        return NextResponse.json({ ok: true });
      }

      // wizard step
      const st = await getState(tgId);

      if (st?.state === "await_ad_url") {
        const parsed = parseTmeLink(text);
        if (!parsed) {
          await tgCall("sendMessage", {
            chat_id: chatId,
            text: "Не похоже на ссылку. Пришли в формате https://t.me/username",
          });
          return NextResponse.json({ ok: true });
        }

        // пробуем вытянуть title/аватар (для публичных каналов часто работает)
        let title = parsed.username ? parsed.username : parsed.url;
        let photoFileId: string | null = null;

        if (parsed.username) {
          try {
            const chat = await tgCall<any>("getChat", { chat_id: `@${parsed.username}` });
            if (chat?.title) title = String(chat.title);
            const fid = chat?.photo?.small_file_id || chat?.photo?.big_file_id;
            if (fid) photoFileId = String(fid);
          } catch {
            // норм — просто без меты
          }
        }

        await setState(tgId, "await_ad_reward", {
          url: parsed.url,
          username: parsed.username || null,
          title,
          photoFileId,
        });

        await tgCall("sendMessage", {
          chat_id: chatId,
          text: `Канал: ${title}\nСсылка: ${parsed.url}\n\nТеперь пришли награду (числом), например 100.`,
          disable_web_page_preview: true,
        });
        return NextResponse.json({ ok: true });
      }

      if (st?.state === "await_ad_reward") {
        const n = Number(text.replace(/[^\d]/g, ""));
        const reward = Number.isFinite(n) && n > 0 ? Math.min(n, 100000) : 100;

        await upsertAdvertiserByUrl({
          url: st.data.url,
          username: st.data.username,
          title: st.data.title || st.data.url,
          photoFileId: st.data.photoFileId,
          reward,
        });

        await clearState(tgId);

        await tgCall("sendMessage", {
          chat_id: chatId,
          text: `Готово ✅\nДобавил рекламодателя:\n${st.data.title}\n${st.data.url}\nБонус: +${reward}`,
          disable_web_page_preview: true,
        });

        return NextResponse.json({ ok: true });
      }
    }
  }

  return NextResponse.json({ ok: true });
}
