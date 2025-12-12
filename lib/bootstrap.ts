import fs from "fs";
import path from "path";
import { prisma } from "./db";

let bootPromise: Promise<void> | null = null;

export function ensureBootstrapped() {
  if (!bootPromise) bootPromise = doBoot();
  return bootPromise;
}

async function doBoot() {
  await ensureSpreads();
  await ensureCardsIndex();
}

async function ensureSpreads() {
  const spreads = [
    { key: "three_cards", titleRu: "Три карты", cardsCount: 3, price: 125 },
    { key: "celtic_cross", titleRu: "Кельтский крест", cardsCount: 10, price: 1500 },
    { key: "station_for_two", titleRu: "Вокзал для двоих", cardsCount: 2, price: 250 },
    { key: "future_of_pair", titleRu: "Будущее пары", cardsCount: 3, price: 250 },
    { key: "doctor_aibolit", titleRu: "Доктор Айболит", cardsCount: 9, price: 800 },
    { key: "my_health", titleRu: "Моё здоровье", cardsCount: 6, price: 600 },
    { key: "money_tree", titleRu: "Денежное дерево", cardsCount: 5, price: 350 },
    { key: "money_on_barrel", titleRu: "Деньги на бочку", cardsCount: 5, price: 300 }
  ];

  for (const s of spreads) {
    await prisma.spread.upsert({
      where: { key: s.key },
      update: s,
      create: s,
    });
  }
}

async function ensureCardsIndex() {
  const count = await prisma.card.count();
  if (count > 0) return;

  const cardsDir = path.join(process.cwd(), "public", "cards");
  if (!fs.existsSync(cardsDir)) return;

  const files = fs.readdirSync(cardsDir);
  const imageFiles = files
    .filter((f) => /\.(jpg|jpeg|png|webp)$/i.test(f))
    .filter((f) => !/^card-back\./i.test(f)); // важно: back исключаем

  const data = imageFiles.map((file) => {
    const slug = file.replace(/\.(jpg|jpeg|png|webp)$/i, "");
    return { slug, titleRu: slug.replace(/-unified$/,"").replace(/-/g, " "), meaningRu: "", adviceRu: "" };
  });

  if (data.length) {
    await prisma.card.createMany({ data, skipDuplicates: true });
  }
}
