import { CARD_SLUGS, type CardSlug } from "@/lib/deck";

function mskDayKey(): string {
  // YYYY-MM-DD (MSK)
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Moscow",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  return parts; // en-CA уже даёт YYYY-MM-DD
}

// FNV-1a 32-bit
function hash32(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h >>> 0;
}

export function pickDailySlug(): CardSlug {
  const key = mskDayKey();
  const seed = hash32(`daily:${key}`);
  const idx = seed % CARD_SLUGS.length;
  return CARD_SLUGS[idx];
}

export function todayRu(): string {
  return new Date().toLocaleDateString("ru-RU", {
    day: "2-digit",
    month: "long",
    timeZone: "Europe/Moscow",
  });
}

export function dailyTexts(titleRu: string, slug: string) {
  const seed = hash32(`txt:${slug}:${mskDayKey()}`);

  const vibes = [
    "спокойно и уверенно",
    "мягко, но точно",
    "смело и по-взрослому",
    "тихо, но глубоко",
    "без спешки — с ощущением смысла",
  ];
  const actions = [
    "сделай один ясный шаг",
    "закрой то, что тянется хвостом",
    "выбери честность вместо удобства",
    "не спорь с реальностью — договорись с ней",
    "обрати внимание на знак в мелочах",
  ];
  const guard = [
    "не расплескать энергию на чужое",
    "не идти из страха",
    "не давить на себя",
    "не пытаться контролировать всё",
    "не ускорять то, что должно созреть",
  ];

  const v = vibes[seed % vibes.length];
  const a = actions[(seed >>> 3) % actions.length];
  const g = guard[(seed >>> 6) % guard.length];

  const meaningRu =
    `Сегодняшняя карта — «${titleRu}». День раскрывается ${v}: ` +
    `важно уловить главный мотив и действовать не суетой, а намерением.`;

  const adviceRu =
    `Сохрани внутренний центр: ${a}. ` +
    `И постарайся ${g}.`;

  return { meaningRu, adviceRu };
}
