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
  const i = Math.floor(Math.random() * CARD_SLUGS.length);
  return CARD_SLUGS[i];
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

  // 1) если уже крутили сегодня — просто возвращаем сохранённую карту
  const existing = await prisma.wheelSpin.findUnique({
    where: { userId_date: { userId: session.userId, date: dateKey } },
    include: { card: true },
  });

  if (existing) {
    const slug = existing.card.slug;
    const titleRu = ruTitleFromSlug(slug);

    let meaningRu = existing.card.meaningRu || "";
    let adviceRu = existing.card.adviceRu || "";

    // гидрируем, если тексты пустые/шаблонные
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

    return NextResponse.json({
      already: true,
      nextInMinutes,
      card: {
        slug,
        titleRu,
        meaningRu,
        adviceRu,
        image: resolveCardImage(slug),
      },
    });
  }

  // 2) если не крутили — выбираем карту, создаём/обновляем Card, сохраняем WheelSpin
  const slug = pickRandomSlug();
  const titleRu = ruTitleFromSlug(slug);

  // ensure Card row
  const card = await prisma.card.upsert({
    where: { slug },
    update: {},
    create: {
      slug,
      titleRu,
      meaningRu: "",
      adviceRu: "",
    },
  });

  let meaningRu = card.meaningRu || "";
  let adviceRu = card.adviceRu || "";

  // генерируем тексты, если пусто/шаблонно
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

  // записываем спин (с защитой от гонки)
  try {
    await prisma.wheelSpin.create({
      data: {
        userId: session.userId,
        date: dateKey,
        cardId: card.id,
      },
    });
  } catch (e: any) {
    // если два запроса одновременно — уникальность могла сработать
    // тогда читаем существующий и отдаём его
    const again = await prisma.wheelSpin.findUnique({
      where: { userId_date: { userId: session.userId, date: dateKey } },
      include: { card: true },
    });

    if (again) {
      const s2 = again.card.slug;
      return NextResponse.json({
        already: true,
        nextInMinutes,
        card: {
          slug: s2,
          titleRu: ruTitleFromSlug(s2),
          meaningRu: again.card.meaningRu,
          adviceRu: again.card.adviceRu,
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
      meaningRu,
      adviceRu,
      image: resolveCardImage(slug),
    },
  });
}
