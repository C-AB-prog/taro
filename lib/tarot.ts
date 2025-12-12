import { prisma } from "./db";
import { todayKey } from "./time";
import { ensureBootstrapped } from "./bootstrap";
import { generateCardTexts, generateSpreadInterpretation } from "./ai";
import fs from "fs";
import path from "path";

function pickRandom<T>(arr: T[]) {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function resolveCardImage(slug: string) {
  const dir = path.join(process.cwd(), "public", "cards");
  const exts = [".jpg", ".jpeg", ".png", ".webp"];
  for (const ext of exts) {
    if (fs.existsSync(path.join(dir, `${slug}${ext}`))) return `/cards/${slug}${ext}`;
  }
  return `/cards/${slug}.jpg`;
}

async function ensureCardTexts(cardId: string, slug: string) {
  const card = await prisma.card.findUnique({ where: { id: cardId } });
  if (!card) return null;

  if (card.meaningRu && card.adviceRu) return card;

  const t = await generateCardTexts(slug);
  return prisma.card.update({
    where: { id: cardId },
    data: { titleRu: t.titleRu, meaningRu: t.meaningRu, adviceRu: t.adviceRu },
  });
}

export async function getOrCreateDailyCard() {
  await ensureBootstrapped();
  const date = todayKey();

  const existing = await prisma.dailyCard.findUnique({
    where: { date },
    include: { card: true },
  });

  if (existing) {
    const hydrated = await ensureCardTexts(existing.card.id, existing.card.slug);
    return hydrated ?? existing.card;
  }

  const cards = await prisma.card.findMany();
  const card = pickRandom(cards);

  await prisma.dailyCard.create({ data: { date, cardId: card.id } });
  const hydrated = await ensureCardTexts(card.id, card.slug);
  return hydrated ?? card;
}

export async function spinWheel(userId: string) {
  await ensureBootstrapped();
  const date = todayKey();

  const existing = await prisma.wheelSpin.findUnique({
    where: { userId_date: { userId, date } },
    include: { card: true },
  });

  if (existing) {
    const hydrated = await ensureCardTexts(existing.card.id, existing.card.slug);
    return { already: true as const, card: hydrated ?? existing.card };
  }

  const cards = await prisma.card.findMany();
  const card = pickRandom(cards);

  await prisma.wheelSpin.create({ data: { userId, date, cardId: card.id } });

  const hydrated = await ensureCardTexts(card.id, card.slug);
  return { already: false as const, card: hydrated ?? card };
}

export function spreadPositions(key: string, n: number) {
  switch (key) {
    case "three_cards": return ["Прошлое", "Настоящее", "Будущее"];
    case "celtic_cross":
      return [
        "Суть ситуации","Что мешает","Корень","Прошлое","Цель","Ближайшее будущее",
        "Ты в ситуации","Окружение","Надежды/страхи","Итог"
      ];
    case "station_for_two": return ["Мысли гадающего", "Мысли партнёра"];
    case "future_of_pair": return ["Мысли партнёра", "Что между вами сейчас", "Чувства партнёра"];
    case "doctor_aibolit":
      return ["Состояние 1","Состояние 2","Фактор 3","Фактор 4","Фактор 5","Фактор 6","Фактор 7","Фактор 8","Фактор 9"];
    case "money_tree": return ["Корень (прошлое)", "Ствол (настоящее)", "Помощники", "Помехи", "Плоды (итог)"];
    case "money_on_barrel": return ["Отношение к деньгам","Как тратишь","Что сдерживает","Что помогает","Верный вектор"];
    default: return Array.from({ length: n }, (_, i) => `Позиция ${i + 1}`);
  }
}

export async function buySpread(userId: string, spreadKey: string) {
  await ensureBootstrapped();

  const spread = await prisma.spread.findUnique({ where: { key: spreadKey } });
  if (!spread) throw new Error("Spread not found");

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error("User not found");

  if (user.balance < spread.price) throw new Error("NOT_ENOUGH_BALANCE");

  const cards = await prisma.card.findMany();
  const shuffled = [...cards].sort(() => Math.random() - 0.5);
  const picked = shuffled.slice(0, spread.cardsCount);

  // подгрузим тексты карт если пустые
  const hydrated = [];
  for (const c of picked) {
    const hc = await ensureCardTexts(c.id, c.slug);
    hydrated.push(hc ?? c);
  }

  const positions = spreadPositions(spread.key, spread.cardsCount);
  const interpretation = await generateSpreadInterpretation({
    spreadTitle: spread.titleRu,
    cards: hydrated.map(c => ({ titleRu: c.titleRu, meaningRu: c.meaningRu || "Здесь скрыт важный знак для тебя." })),
    positions,
  });

  const purchase = await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: userId },
      data: { balance: { decrement: spread.price } },
    });

    await tx.transaction.create({
      data: {
        userId,
        type: "spend",
        amount: spread.price,
        provider: "system",
        providerPayload: { reason: "spread_purchase", spreadKey },
      },
    });

    return tx.spreadPurchase.create({
      data: {
        userId,
        spreadId: spread.id,
        paidAmount: spread.price,
        cardsJson: hydrated.map(c => c.slug),
        interpretation,
      },
      include: { spread: true },
    });
  });

  return purchase;
}
