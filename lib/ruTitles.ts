const MAJOR: Record<string, string> = {
  "fool": "Шут",
  "magician": "Маг",
  "high-priestess": "Верховная Жрица",
  "empress": "Императрица",
  "emperor": "Император",
  "hierophant": "Иерофант",
  "lovers": "Влюблённые",
  "chariot": "Колесница",
  "strength": "Сила",
  "hermit": "Отшельник",
  "wheel-of-fortune": "Колесо Фортуны",
  "justice": "Правосудие",
  "hanged-man": "Повешенный",
  "death": "Смерть",
  "temperance": "Умеренность",
  "devil": "Дьявол",
  "tower": "Башня",
  "star": "Звезда",
  "moon": "Луна",
  "sun": "Солнце",
  "judgement": "Суд",
  "judgment": "Суд",
  "world": "Мир",
};

const RANK: Record<string, string> = {
  "ace": "Туз",
  "two": "Двойка",
  "three": "Тройка",
  "four": "Четвёрка",
  "five": "Пятёрка",
  "six": "Шестёрка",
  "seven": "Семёрка",
  "eight": "Восьмёрка",
  "nine": "Девятка",
  "ten": "Десятка",
  "page": "Паж",
  "knight": "Рыцарь",
  "queen": "Королева",
  "king": "Король",
};

const SUIT: Record<string, string> = {
  "cups": "кубков",
  "pentacles": "пентаклей",
  "swords": "мечей",
  "wands": "жезлов",
};

function titleCaseFallback(s: string) {
  return s
    .replace(/-/g, " ")
    .replace(/\b\w/g, (m) => m.toUpperCase());
}

export function ruTitleFromSlug(slug: string): string {
  const s = String(slug || "");

  // Старшие арканы: "10-the-wheel-of-fortune-unified"
  const m1 = s.match(/^(\d+)-the-(.+)-unified$/);
  if (m1) {
    const key = m1[2];
    return MAJOR[key] ?? titleCaseFallback(key);
  }

  // Младшие арканы: "five-of-wands-unified", "king-of-swords-unified"
  const m2 = s.match(/^([a-z]+)-of-([a-z]+)-unified$/);
  if (m2) {
    const r = RANK[m2[1]] ?? titleCaseFallback(m2[1]);
    const suit = SUIT[m2[2]] ?? titleCaseFallback(m2[2]);
    return `${r} ${suit}`;
  }

  return titleCaseFallback(s.replace(/-unified$/, ""));
}
