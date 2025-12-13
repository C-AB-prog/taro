// Чисто для отображения (slug НЕ меняем — иначе сломаются картинки)

const MAJOR: Record<string, string> = {
  "0-the-fool-unified": "Шут",
  "1-the-magician-unified": "Маг",
  "2-the-high-priestess-unified": "Верховная Жрица",
  "3-the-empress-unified": "Императрица",
  "4-the-emperor-unified": "Император",
  "5-the-hierophant-unified": "Иерофант",
  "6-the-lovers-unified": "Влюблённые",
  "7-the-chariot-unified": "Колесница",
  "8-the-strength-unified": "Сила",
  "9-the-hermit-unified": "Отшельник",
  "10-the-wheel-of-fortune-unified": "Колесо Фортуны",
  "11-the-justice-unified": "Правосудие",
  "12-the-hanged-man-unified": "Повешенный",
  "13-the-death-unified": "Смерть",
  "14-the-temperance-unified": "Умеренность",
  "15-the-devil-unified": "Дьявол",
  "16-the-tower-unified": "Башня",
  "17-the-star-unified": "Звезда",
  "18-the-moon-unified": "Луна",
  "19-the-sun-unified": "Солнце",
  "20-the-judgement-unified": "Суд",
  "21-the-world-unified": "Мир",
};

const RANK: Record<string, string> = {
  ace: "Туз",
  two: "Двойка",
  three: "Тройка",
  four: "Четвёрка",
  five: "Пятёрка",
  six: "Шестёрка",
  seven: "Семёрка",
  eight: "Восьмёрка",
  nine: "Девятка",
  ten: "Десятка",
  page: "Паж",
  knight: "Рыцарь",
  queen: "Королева",
  king: "Король",
};

const SUIT: Record<string, string> = {
  wands: "Жезлов",
  cups: "Кубков",
  swords: "Мечей",
  pentacles: "Пентаклей",
};

export function ruTitleFromSlug(slug: string): string {
  // 1) Старшие арканы по точной карте
  if (MAJOR[slug]) return MAJOR[slug];

  // 2) Младшие (two-of-cups-unified)
  const base = slug.replace(/\.jpg$/i, "").replace(/-unified$/i, "");
  const m = base.match(/^(ace|two|three|four|five|six|seven|eight|nine|ten|page|knight|queen|king)-of-(wands|cups|swords|pentacles)$/i);
  if (m) {
    const r = RANK[m[1].toLowerCase()] ?? m[1];
    const s = SUIT[m[2].toLowerCase()] ?? m[2];
    return `${r} ${s}`;
  }

  // 3) если что-то нестандартное — покажем как есть
  return slug;
}
