import { NextResponse } from "next/server";
import { tgCall } from "@/lib/telegramBot";
import { prisma } from "@/lib/prisma";
import { SHOP_PACKS, parsePayload } from "@/lib/shop";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SECRET = process.env.TELEGRAM_WEBHOOK_SECRET || "";

async function ensurePaymentsTable() {
  // создадим таблицу один раз (если уже есть — no-op)
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

  const rows = await prisma.$executeRawUnsafe(`
    INSERT INTO "StarsPayment" ("telegramChargeId","userId","packId","stars","coins","payload")
    VALUES ('${params.telegramChargeId}', '${params.userId}', '${params.packId}', ${params.stars}, ${params.coins}, '${params.payload}')
    ON CONFLICT ("telegramChargeId") DO NOTHING;
  `);

  // в postgres это обычно 0 или 1 — если 0, значит уже обработали
  return Number(rows) > 0;
}

export async function POST(req: Request) {
  // простая проверка secret_token от Telegram setWebhook
  const gotSecret = req.headers.get("x-telegram-bot-api-secret-token") || "";
  if (SECRET && gotSecret !== SECRET) {
    return NextResponse.json({ ok: true }); // не палим детали
  }

  const update = await req.json().catch(() => null);
  if (!update) return NextResponse.json({ ok: true });

  // 1) pre_checkout_query — надо ответить за 10 сек :contentReference[oaicite:8]{index=8}
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
    const ok =
      q.currency === "XTR" &&
      Number(q.total_amount) === pack.stars; // Stars = amount в XTR :contentReference[oaicite:9]{index=9}

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

    const pack = SHOP_PACKS[parsed.packId];

    // в Stars валюта XTR и prices один элемент, total_amount = сумма в Stars :contentReference[oaicite:10]{index=10}
    if (sp.currency !== "XTR") return NextResponse.json({ ok: true });
    if (Number(sp.total_amount) !== pack.stars) return NextResponse.json({ ok: true });

    const telegramChargeId = String(sp.telegram_payment_charge_id || "");
    if (!telegramChargeId) return NextResponse.json({ ok: true });

    // идемпотентность (чтобы не начислить дважды)
    const inserted = await markProcessed({
      telegramChargeId,
      userId: parsed.userId,
      packId: parsed.packId,
      stars: pack.stars,
      coins: pack.coins,
      payload,
    });

    if (inserted) {
      // ✅ начисляем внутриигровую валюту
      await prisma.user.update({
        where: { id: parsed.userId },
        data: { balance: { increment: pack.coins } },
      });
    }
  }

  return NextResponse.json({ ok: true });
}
