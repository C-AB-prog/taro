import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySession } from "@/lib/auth";
import { tgCall } from "@/lib/telegramBot";
import { SHOP_PACKS, isPackId, makePayload } from "@/lib/shop";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function unauthorized() {
  const res = NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  res.cookies.set("session", "", { path: "/", maxAge: 0 });
  return res;
}

export async function POST(req: Request) {
  try {
    const token = cookies().get("session")?.value;
    if (!token) return unauthorized();

    let session: any;
    try {
      session = await verifySession(token);
    } catch {
      return unauthorized();
    }

    const body = await req.json().catch(() => ({}));
    const packId = body?.packId;

    if (!isPackId(packId)) {
      return NextResponse.json({ ok: false, error: "BAD_PACK" }, { status: 400 });
    }

    if (!process.env.TELEGRAM_BOT_TOKEN) {
      return NextResponse.json({ ok: false, error: "NO_TELEGRAM_BOT_TOKEN" }, { status: 500 });
    }

    const pack = SHOP_PACKS[packId];
    const payload = makePayload({ userId: session.userId, packId });

    const link = await tgCall<string>("createInvoiceLink", {
      title: `Пополнение: ${pack.coins} валюты`,
      description: `Пак ${pack.stars} Stars → ${pack.coins} внутриигровой валюты`,
      payload,
      provider_token: "", // Stars
      currency: "XTR",
      prices: [{ label: `${pack.stars} Stars`, amount: pack.stars }], // для Stars ровно 1 item
    });

    return NextResponse.json({ ok: true, invoiceLink: link }, { headers: { "Cache-Control": "no-store" } });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: "INVOICE_FAILED", message: e?.message ?? String(e) },
      { status: 500 }
    );
  }
}
