import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySession } from "@/lib/auth";
import { tgCall } from "@/lib/telegramBot";
import { SHOP_PACKS, isPackId, makePayload } from "@/lib/shop";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const token = cookies().get("session")?.value;
  if (!token) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const session = await verifySession(token);
  const { packId } = await req.json();

  if (!isPackId(packId)) {
    return NextResponse.json({ error: "BAD_PACK" }, { status: 400 });
  }

  const pack = SHOP_PACKS[packId];
  const payload = makePayload({ userId: session.userId, packId });

  const link = await tgCall<string>("createInvoiceLink", {
    title: `Пополнение: ${pack.coins} валюты`,
    description: `Пак ${pack.stars} Stars → ${pack.coins} внутриигровой валюты`,
    payload,
    provider_token: "",         // для Stars можно пусто :contentReference[oaicite:4]{index=4}
    currency: "XTR",            // Stars :contentReference[oaicite:5]{index=5}
    prices: [{ label: `${pack.stars} Stars`, amount: pack.stars }], // для Stars ровно 1 item :contentReference[oaicite:6]{index=6}
  });

  return NextResponse.json({ ok: true, invoiceLink: link });
}
