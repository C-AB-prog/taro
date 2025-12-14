import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveCardImage } from "@/lib/tarot";
import { ruTitleFromSlug } from "@/lib/ruTitles";
import { generateCardReadingRu } from "@/lib/tarotReadings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MSK_OFFSET_MS = 3 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

function mskDayStartUtc(d = new Date()) {
  const nowMs = d.getTime();
  const mskNow = nowMs + MSK_OFFSET_MS;
  const day = Math.floor(mskNow / DAY_MS);
  const startMsk = day * DAY_MS;
  const startUtc = startMsk - MSK_OFFSET_MS;
  return new Date(startUtc);
}

function looksTemplate(meaning: string, advice: string) {
  const m = (meaning || "").toLowerCase();
  const a = (advice || "").toLowerCase();
  if (m.length < 60 || a.length < 20) return true;

  const bad = [
    "важный мотив",
    "скрытый смысл происходящего",
    "береги себя",
    "действуй мягко",
    "правильный момент",
  ];
  return bad.some((x) => m.includes(x) || a.includes(x));
}

async function hydrateCardTexts(slug: string, titleRu: string, meaningRu: string, adviceRu: string) {
  let m = meaningRu || "";
  let a = adviceRu || "";

  if (!m || !a || looksTemplate(m, a)) {
    try {
      const gen = await generateCardReadingRu({ titleRu, kind: "wheel" });
      m = gen.meaningRu;
      a = gen.adviceRu;

      await prisma.card.update({
        where: { slug },
        data: { titleRu, meaningRu: m, adviceRu: a },
      });
    } catch {}
  }

  return { meaningRu: m, adviceRu: a };
}

export async function GET() {
  const token = cookies().get("session")?.value;
  if (!token) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  let session: { userId: string };
  try {
    session = await verifySession(token);
  } catch {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const dateKey = mskDayStartUtc();

  const existing = await prisma.wheelSpin.findUnique({
    where: { userId_date: { userId: session.userId, date: dateKey } },
    include: { card: true },
  });

  if (!existing) return NextResponse.json({ already: false });

  const slug = existing.card.slug;
  const titleRu = ruTitleFromSlug(slug);

  const hydrated = await hydrateCardTexts(slug, titleRu, existing.card.meaningRu || "", existing.card.adviceRu || "");

  return NextResponse.json({
    already: true,
    card: {
      slug,
      titleRu,
      meaningRu: hydrated.meaningRu,
      adviceRu: hydrated.adviceRu,
      image: resolveCardImage(slug),
    },
  });
}
