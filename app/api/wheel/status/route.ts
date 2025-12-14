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

function nextMskMidnightInSeconds() {
  const nowMs = Date.now();
  const mskNow = nowMs + MSK_OFFSET_MS;
  const nextMidMsk = (Math.floor(mskNow / DAY_MS) + 1) * DAY_MS;
  const nextMidUtc = nextMidMsk - MSK_OFFSET_MS;
  const diffMs = Math.max(0, nextMidUtc - nowMs);
  return Math.ceil(diffMs / 1000);
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

function unauthorized() {
  const res = NextResponse.json({ ok: false, error: "UNAUTHORIZED" }, { status: 401 });
  res.cookies.set("session", "", { path: "/", maxAge: 0 });
  return res;
}

export async function GET() {
  const token = cookies().get("session")?.value;
  if (!token) return unauthorized();

  let session: { userId: string };
  try {
    session = await verifySession(token);
  } catch {
    return unauthorized();
  }

  const dateKey = mskDayStartUtc();
  const nextInSeconds = nextMskMidnightInSeconds();

  const existing = await prisma.wheelSpin.findUnique({
    where: { userId_date: { userId: session.userId, date: dateKey } },
    include: { card: true },
  });

  if (!existing) {
    return NextResponse.json(
      { ok: true, already: false, nextInSeconds, card: null },
      { headers: { "Cache-Control": "no-store" } }
    );
  }

  const slug = existing.card.slug;
  const titleRu = ruTitleFromSlug(slug);

  let meaningRu = existing.card.meaningRu || "";
  let adviceRu = existing.card.adviceRu || "";

  if (!meaningRu || !adviceRu || looksTemplate(meaningRu, adviceRu)) {
    try {
      const gen = await generateCardReadingRu({ titleRu, kind: "wheel" });
      meaningRu = gen.meaningRu;
      adviceRu = gen.adviceRu;

      await prisma.card.update({
        where: { slug },
        data: { titleRu, meaningRu, adviceRu },
      });
    } catch {}
  }

  return NextResponse.json(
    {
      ok: true,
      already: true,
      nextInSeconds,
      card: {
        slug,
        titleRu,
        meaningRu,
        adviceRu,
        image: resolveCardImage(slug),
      },
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
