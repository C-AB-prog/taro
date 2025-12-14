import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveCardImage } from "@/lib/tarot";
import { ruTitleFromSlug } from "@/lib/ruTitles";
import { generateCardReadingRu } from "@/lib/tarotReadings";
import { CARD_SLUGS } from "@/lib/deck";

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

function nextMskMidnightInMinutes() {
  const nowMs = Date.now();
  const mskNow = nowMs + MSK_OFFSET_MS;
  const nextMidMsk = (Math.floor(mskNow / DAY_MS) + 1) * DAY_MS;
  const nextMidUtc = nextMidMsk - MSK_OFFSET_MS;
  const diffMs = Math.max(0, nextMidUtc - nowMs);
  return Math.ceil(diffMs / 60000);
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

function pickRandomSlug() {
  // ✅ безопасно исключаем card-back, даже если он вдруг появится
  const pool = (CARD_SLUGS as unknown as string[]).filter((s) => !String(s).includes("card-back"));
  const arr = pool.length ? pool : (CARD_SLUGS as unknown as string[]);
  const i = Math.floor(Math.random() * arr.length);
  return arr[i];
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
    } catch {
      // если ИИ временно не ответил — просто оставим как есть
    }
  }

  return { meaningRu: m, adviceRu: a };
}

export async function POST() {
  const token = cookies().get("session")?.value;
  if (!token) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });

  let session: { userId: string };
  try {
    session = await verifySession(token);
  } catch {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const dateKey = mskDayStartUtc();
  const nextInMinutes = nextMskMidnightInMinutes();

  // 1) если уже крутили сегодня — возвращаем сохранённую карту
  const existing = await prisma.wheelSpin.findUnique({
    where: { userId_date: { userId: session.userId, date: dateKey } },
    include: { card: true },
  });

  if (existing) {
    const slug = existing.card.slug;
    const titleRu = ruTitleFromSlug(slug);

    const hydrated = await hydrateCardTexts(slug, titleRu, existing.card.meaningRu || "", existing.card.adviceRu || "");

    return NextResponse.json({
      already: true,
      nextInMinutes,
      card: {
        slug,
        titleRu,
        meaningRu: hydrated.meaningRu,
        adviceRu: hydrated.adviceRu,
        image: resolveCardImage(slug),
      },
    });
  }

  // 2) если не крутили — выбираем карту и сохраняем
  const slug = pickRandomSlug();
  const titleRu = ruTitleFromSlug(slug);

  const card = await prisma.card.upsert({
    where: { slug },
    update: { titleRu }, // ✅ на всякий случай обновим заголовок
    create: {
      slug,
      titleRu,
      meaningRu: "",
      adviceRu: "",
    },
  });

  const hydrated = await hydrateCardTexts(slug, titleRu, card.meaningRu || "", card.adviceRu || "");

  // записываем спин (с защитой от гонки)
  try {
    await prisma.wheelSpin.create({
      data: {
        userId: session.userId,
        date: dateKey,
        cardId: card.id,
      },
    });
  } catch {
    // если два запроса одновременно — уникальность могла сработать
    const again = await prisma.wheelSpin.findUnique({
      where: { userId_date: { userId: session.userId, date: dateKey } },
      include: { card: true },
    });

    if (again) {
      const s2 = again.card.slug;
      const t2 = ruTitleFromSlug(s2);
      const hydrated2 = await hydrateCardTexts(s2, t2, again.card.meaningRu || "", again.card.adviceRu || "");

      return NextResponse.json({
        already: true,
        nextInMinutes,
        card: {
          slug: s2,
          titleRu: t2,
          meaningRu: hydrated2.meaningRu,
          adviceRu: hydrated2.adviceRu,
          image: resolveCardImage(s2),
        },
      });
    }

    return NextResponse.json({ error: "SPIN_FAILED" }, { status: 500 });
  }

  return NextResponse.json({
    already: false,
    nextInMinutes,
    card: {
      slug,
      titleRu,
      meaningRu: hydrated.meaningRu,
      adviceRu: hydrated.adviceRu,
      image: resolveCardImage(slug),
    },
  });
}
