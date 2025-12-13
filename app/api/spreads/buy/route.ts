import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySession } from "@/lib/auth";
import { buySpread, resolveCardImage, spreadPositions } from "@/lib/tarot";

export async function POST(req: Request) {
  const token = cookies().get("session")?.value;
  if (!token) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const { spreadKey } = await req.json();
  const session = await verifySession(token);

  try {
    const purchase = await buySpread(session.userId, spreadKey);

    const slugs = purchase.cardsJson as unknown as string[];
    const positions = spreadPositions(spreadKey, slugs.length);

    const view = {
      spreadTitle: purchase.spread.titleRu,
      paidAmount: purchase.paidAmount,
      positions,
      cards: slugs.map((slug) => ({ slug, image: resolveCardImage(slug) })),
      interpretation: purchase.interpretation,
    };

    return NextResponse.json({ ok: true, view });
  } catch (e: any) {
    if (e?.message === "NOT_ENOUGH_BALANCE") {
      return NextResponse.json({ error: "NOT_ENOUGH_BALANCE" }, { status: 402 });
    }
    return NextResponse.json({ error: "BUY_FAILED" }, { status: 400 });
  }
}
