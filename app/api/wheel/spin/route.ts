import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySession } from "@/lib/auth";
import { spinWheel, resolveCardImage } from "@/lib/tarot";

export async function POST() {
  const token = cookies().get("session")?.value;
  if (!token) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  const session = await verifySession(token);
  const result = await spinWheel(session.userId);

  return NextResponse.json({
    already: result.already,
    card: {
      slug: result.card.slug,
      titleRu: result.card.titleRu,
      meaningRu: result.card.meaningRu,
      adviceRu: result.card.adviceRu,
      image: resolveCardImage(result.card.slug),
    },
  });
}
