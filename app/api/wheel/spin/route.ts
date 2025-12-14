import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { verifySession } from "@/lib/auth";
import { spinWheel, resolveCardImage } from "@/lib/tarot";
import { prisma } from "@/lib/prisma";
import { generateCardReadingRu } from "@/lib/tarotReadings";
import { ruTitleFromSlug } from "@/lib/ruTitles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MSK_OFFSET_MS = 3 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

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

  // маркеры “шаблонности” (если вдруг остались старые тексты)
  const bad = [
    "важный мотив",
    "скрытый смысл происходящего",
    "береги себя",
    "действуй мягко",
    "правильный момент",
  ];
  return bad.some((x) => m.includes(x) || a.includes(x));
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

  const result = await spinWheel(session.userId);
  const mins = nextMskMidnightInMinutes();

  // Card из spinWheel может быть с пустыми/старыми текстами → гидрируем
  const slug = result.card.slug;
  const titleRu = ruTitleFromSlug(slug);

  let meaningRu = result.card.meaningRu || "";
  let adviceRu = result.card.adviceRu || "";
  let aiSource: "db" | "ai" = "db";
  let model: string | null = null;
  let forced = false;

  const needAi = looksTemplate(meaningRu, adviceRu) || !meaningRu || !adviceRu;

  if (needAi) {
    try {
      forced = true;
      const gen = await generateCardReadingRu({
        titleRu,
        kind: "wheel",
      });
      meaningRu = gen.meaningRu;
      adviceRu = gen.adviceRu;
      model = (gen as any)?.model ?? null;
      aiSource = "ai";

      // сохраняем в БД, чтобы дальше было быстрее
      await prisma.card.update({
        where: { slug },
        data: {
          titleRu,
          meaningRu,
          adviceRu,
        },
      });
    } catch {
      // если ИИ упал — просто отдаём то, что есть
      aiSource = "db";
      forced = false;
    }
  }

  return NextResponse.json({
    already: result.already,
    nextInMinutes: mins,
    card: {
      slug,
      titleRu,
      meaningRu,
      adviceRu,
      image: resolveCardImage(slug),
    },
    aiSource,
    model,
    forced,
  });
}
