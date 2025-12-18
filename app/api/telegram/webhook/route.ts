// app/api/telegram/webhook/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET || "";
const APP_URL = (process.env.APP_URL || "").replace(/\/+$/, "");
const ADMIN_TG_IDS = (process.env.ADMIN_TG_IDS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

function isAdmin(tgId?: number | string | null) {
  if (!tgId) return false;
  return ADMIN_TG_IDS.includes(String(tgId));
}

async function tgCall(method: string, payload: any) {
  if (!BOT_TOKEN) throw new Error("Missing TELEGRAM_BOT_TOKEN");
  const r = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const j = await r.json().catch(() => ({}));
  return j;
}

function getCommandText(msg: any): { cmd: string; args: string } | null {
  const text = String(msg?.text || "").trim();
  if (!text.startsWith("/")) return null;

  // command may include "@botname"
  const first = text.split(/\s+/)[0] || "";
  const cmd = first.split("@")[0] || "";
  const args = text.slice(first.length).trim();
  return { cmd, args };
}

function buildMainWebAppKeyboard() {
  // Button name required: "Карта дня"
  return {
    inline_keyboard: [
      [
        {
          text: "🃏 Карта дня",
          web_app: { url: `${APP_URL}/` },
        },
      ],
    ],
  };
}

function welcomeText() {
  // Bright & long welcome
  return (
    `✨ Добро пожаловать в Tarot Day ✨\n\n` +
    `Здесь ты можешь:\n` +
    `• Получать «Карту дня» и короткий смысл\n` +
    `• Делать расклады (покупка за внутреннюю валюту)\n` +
    `• Крутить колесо и получать бонусы\n` +
    `• Выполнять задания и зарабатывать 💰\n\n` +
    `🃏 Нажми кнопку «Карта дня» ниже — и приложение откроется прямо в Telegram.\n\n` +
    `Если что-то не открывается:\n` +
    `1) Открой именно через Telegram (не через браузер)\n` +
    `2) Обнови приложение Telegram\n` +
    `3) Перезапусти мини-апп\n\n` +
    `Удачных предсказаний 🔮`
  );
}

async function handleStart(chatId: number) {
  // Send photo + long message + button "Карта дня"
  const photoUrl = APP_URL ? `${APP_URL}/logo.png` : undefined;

  if (photoUrl) {
    await tgCall("sendPhoto", {
      chat_id: chatId,
      photo: photoUrl,
      caption: welcomeText(),
      parse_mode: "HTML",
      reply_markup: buildMainWebAppKeyboard(),
    });
  } else {
    await tgCall("sendMessage", {
      chat_id: chatId,
      text: welcomeText(),
      reply_markup: buildMainWebAppKeyboard(),
    });
  }
}

async function handleStat(chatId: number) {
  const [totalRow] = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*)::bigint AS count FROM "User"
  `;
  const [todayRow] = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*)::bigint AS count
    FROM "User"
    WHERE "createdAt" >= date_trunc('day', now())
  `;
  const [activeTodayRow] = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*)::bigint AS count
    FROM "User"
    WHERE "lastSeenAt" >= date_trunc('day', now())
  `;
  const [active30Row] = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*)::bigint AS count
    FROM "User"
    WHERE "lastSeenAt" >= now() - interval '30 days'
  `;

  const text =
    `📊 Статистика\n\n` +
    `• Всего пользователей: ${Number(totalRow?.count || 0)}\n` +
    `• Новых сегодня: ${Number(todayRow?.count || 0)}\n` +
    `• Активных сегодня: ${Number(activeTodayRow?.count || 0)}\n` +
    `• Активных за 30 дней: ${Number(active30Row?.count || 0)}`;

  await tgCall("sendMessage", { chat_id: chatId, text });
}

async function handleListAd(chatId: number) {
  const rows = await prisma.$queryRaw<
    Array<{ id: string; title: string; url: string; reward: number; active: boolean; createdAt: Date }>
  >`
    SELECT "id","title","url","reward","active","createdAt"
    FROM "AdOffer"
    WHERE "active" = true
    ORDER BY "sort" DESC, "createdAt" DESC
    LIMIT 30
  `;

  if (!rows.length) {
    await tgCall("sendMessage", { chat_id: chatId, text: "Пока нет активных рекламных кампаний." });
    return;
  }

  const lines = rows.map((r, i) => {
    const dt = r.createdAt ? new Date(r.createdAt).toISOString().slice(0, 19).replace("T", " ") : "";
    return `${i + 1}) id: ${r.id}\n   +${r.reward} | ${r.title}\n   ${r.url}\n   ${dt}`;
  });

  await tgCall("sendMessage", {
    chat_id: chatId,
    text: `📣 Активные кампании:\n\n${lines.join("\n\n")}`,
    disable_web_page_preview: true,
  });
}

// Campaign model: /addad always creates a new AdOffer (new id), even if url same.
async function handleAddAd(chatId: number, args: string) {
  // /addad <reward> <url> <title...>
  const parts = String(args || "").trim().split(/\s+/).filter(Boolean);
  const reward = Number(parts.shift() || "0");
  const url = String(parts.shift() || "").trim();
  const title = parts.join(" ").trim() || url;

  if (!url || !/^https?:\/\//i.test(url) || !Number.isFinite(reward) || reward <= 0) {
    await tgCall("sendMessage", {
      chat_id: chatId,
      text:
        "Формат:\n" +
        "/addad <reward> <url> <title>\n\n" +
        "Пример:\n" +
        "/addad 100 https://t.me/CodeAdsBusiness Канал разработчика",
      disable_web_page_preview: true,
    });
    return;
  }

  const rows = await prisma.$queryRaw<Array<{ id: string }>>`
    INSERT INTO "AdOffer" ("title","url","reward","active")
    VALUES (${title}, ${url}, ${Math.floor(reward)}, true)
    RETURNING "id"
  `;
  const id = rows[0]?.id;

  await tgCall("sendMessage", {
    chat_id: chatId,
    text:
      `✅ Добавлена новая кампания\n\n` +
      `id: ${id}\n` +
      `reward: +${Math.floor(reward)}\n` +
      `title: ${title}\n` +
      `url: ${url}\n\n` +
      `Чтобы отключить:\n/delad ${id}`,
    disable_web_page_preview: true,
  });
}

async function handleDelAd(chatId: number, args: string) {
  // /delad <id|url>
  const key = String(args || "").trim();
  if (!key) {
    await tgCall("sendMessage", { chat_id: chatId, text: "Формат:\n/delad <id|url>" });
    return;
  }

  // if looks like URL -> disable latest active by url
  if (/^https?:\/\//i.test(key)) {
    const rows = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT "id"
      FROM "AdOffer"
      WHERE "url" = ${key} AND "active" = true
      ORDER BY "createdAt" DESC
      LIMIT 1
    `;
    const id = rows[0]?.id;
    if (!id) {
      await tgCall("sendMessage", { chat_id: chatId, text: "⚠️ Активная кампания по этой ссылке не найдена." });
      return;
    }
    const updated = await prisma.$executeRaw`
      UPDATE "AdOffer" SET "active" = false WHERE "id" = ${id}
    `;
    await tgCall("sendMessage", {
      chat_id: chatId,
      text: Number(updated) > 0 ? `✅ Отключена кампания: ${id}` : `⚠️ Не получилось отключить: ${id}`,
    });
    return;
  }

  // otherwise treat as id
  const updated = await prisma.$executeRaw`
    UPDATE "AdOffer" SET "active" = false WHERE "id" = ${key}
  `;
  await tgCall("sendMessage", {
    chat_id: chatId,
    text: Number(updated) > 0 ? `✅ Кампания отключена: ${key}` : `⚠️ Не найдено: ${key}`,
  });
}

export async function POST(req: Request) {
  // Webhook secret verification
  if (WEBHOOK_SECRET) {
    const got = req.headers.get("x-telegram-bot-api-secret-token") || "";
    if (got !== WEBHOOK_SECRET) {
      return NextResponse.json({ ok: false }, { status: 401 });
    }
  }

  const update = await req.json().catch(() => null);
  if (!update) return NextResponse.json({ ok: true });

  const msg = update.message || update.edited_message;
  if (!msg) return NextResponse.json({ ok: true });

  const chatId = Number(msg.chat?.id);
  const fromId = msg.from?.id;

  const parsed = getCommandText(msg);
  if (!parsed) return NextResponse.json({ ok: true });

  const { cmd, args } = parsed;

  try {
    if (cmd === "/start") {
      await handleStart(chatId);
      return NextResponse.json({ ok: true });
    }

    if (cmd === "/stat") {
      if (!isAdmin(fromId)) {
        await tgCall("sendMessage", { chat_id: chatId, text: "Команда доступна только админу." });
        return NextResponse.json({ ok: true });
      }
      await handleStat(chatId);
      return NextResponse.json({ ok: true });
    }

    if (cmd === "/addad") {
      if (!isAdmin(fromId)) {
        await tgCall("sendMessage", { chat_id: chatId, text: "Команда доступна только админу." });
        return NextResponse.json({ ok: true });
      }
      await handleAddAd(chatId, args);
      return NextResponse.json({ ok: true });
    }

    if (cmd === "/delad") {
      if (!isAdmin(fromId)) {
        await tgCall("sendMessage", { chat_id: chatId, text: "Команда доступна только админу." });
        return NextResponse.json({ ok: true });
      }
      await handleDelAd(chatId, args);
      return NextResponse.json({ ok: true });
    }

    if (cmd === "/listad") {
      if (!isAdmin(fromId)) {
        await tgCall("sendMessage", { chat_id: chatId, text: "Команда доступна только админу." });
        return NextResponse.json({ ok: true });
      }
      await handleListAd(chatId);
      return NextResponse.json({ ok: true });
    }

    // help for admins (optional)
    if (cmd === "/help" || cmd === "/admin") {
      const t =
        `Команды:\n` +
        `/start — приветствие + кнопка «Карта дня»\n` +
        `/stat — статистика (admin)\n` +
        `/addad <reward> <url> <title> — добавить кампанию (admin)\n` +
        `/delad <id|url> — отключить кампанию (admin)\n` +
        `/listad — список активных кампаний (admin)`;
      await tgCall("sendMessage", { chat_id: chatId, text: t, disable_web_page_preview: true });
      return NextResponse.json({ ok: true });
    }
  } catch {
    // don't fail webhook
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: true });
}
