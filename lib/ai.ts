export async function generateCardTexts(cardSlug: string) {
  return {
    titleRu: humanize(cardSlug),
    meaningRu: `Эта карта показывает важный мотив и скрытый смысл происходящего прямо сейчас.`,
    adviceRu: `Совет: действуй бережно, без давления. Сделай шаг мягко — и путь откроется.`,
  };
}

export async function generateSpreadInterpretation(opts: {
  spreadTitle: string;
  cards: { titleRu: string; meaningRu: string }[];
  positions: string[];
}) {
  const lines = opts.cards.map((c, i) => `• ${opts.positions[i]} — ${c.titleRu}: ${c.meaningRu}`);

  return [
    `✨ Расклад «${opts.spreadTitle}»`,
    "",
    ...lines,
    "",
    "Мистический вывод: сейчас события разворачиваются так, чтобы вернуть тебе внутреннюю ясность. Береги себя, действуй мягко, и ты почувствуешь правильный момент.",
  ].join("\n");
}

function humanize(slug: string) {
  return slug.replace(/-unified$/,"").replace(/-/g, " ");
}
