import { NextResponse } from "next/server";
import { tgCall } from "@/lib/telegramBot";
import { SHOP_PACKS, isPackId, makePayload } from "@/lib/shop";
import { requireUserId } from "@/lib/requireUser";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  // ✅ авторизация: cookie session ИЛИ x-telegram-init-data (fallback)
  let userId = "";
  try {
    userId = await requireUserId(req);
  } catch {
    return NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const packId = body?.packId;

    if (!isPackId(packId)) {
      return NextResponse.json({ ok: false, error: "BAD_PACK" }, { status: 400 });
    }

    if (!process.env.TELEGRAM_BOT_TOKEN) {
      return NextResponse.json({ ok: false, error: "NO_TELEGRAM_BOT_TOKEN" }, { status: 500 });
    }

    const pack = SHOP_PACKS[packId];
    const payload = makePayload({ userId, packId });

    const link = await tgCall<string>("createInvoiceLink", {
      title: `Пополнение: ${pack.coins} валюты`,
      description: `Пак ${pack.stars} Stars → ${pack.coins} внутриигровой валюты`,
      payload,
      provider_token: "", // Stars
      currency: "XTR",
      prices: [{ label: `${pack.stars} Stars`, amount: pack.stars }],
    });

    return NextResponse.json({ ok: true, invoiceLink: link }, { headers: { "Cache-Control": "no-store" } });
  } catch (e: any) {
    // ✅ наружу лучше не давать “сырые” ошибки
    return NextResponse.json({ ok: false, error: "INVOICE_FAILED" }, { status: 400 });
  }
}
