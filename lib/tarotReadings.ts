import "server-only";
import { openai, OPENAI_MODEL } from "@/lib/openai.server";

function clean(s: string) {
  return String(s || "").trim();
}

function safeJsonParse<T>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export async function generateCardReadingRu(opts: {
  titleRu: string; // русское название карты
  kind: "daily" | "wheel";
}) {
  // Fallback если ключа нет / API недоступно
  if (!process.env.OPENAI_API_KEY) {
    return {
      meaningRu: `Сегодня карта «${opts.titleRu}» напоминает: у событий есть скрытый рисунок, и ты уже ближе к развязке, чем кажется.`,
      adviceRu: "Действуй мягко и внимательно к знакам — и нужная дверь откроется сама.",
    };
  }

  const sys =
    `Ты — опытный таролог. Пиши ТОЛЬКО на русском. ` +
    `Стиль: мягко, поддерживающе, мистически-поэтично. ` +
    `Никаких упоминаний ИИ, моделей, подсказок, промптов. ` +
    `Не используй латиницу. ` +
    `Ответ дай строго в JSON (это важно).`;

  const user =
    `Нужно трактование для ${opts.kind === "daily" ? "«Карты дня»" : "«Колеса фортуны»"}.\n` +
    `Карта: «${opts.titleRu}».\n\n` +
    `Верни JSON формата:\n` +
    `{ "meaningRu": "...", "adviceRu": "..." }\n\n` +
    `Правила:\n` +
    `- meaningRu: 2–4 предложения, без запугивания, без категоричных приговоров.\n` +
    `- adviceRu: 1–2 предложения, конкретно и бережно.\n` +
    `- Можно намекнуть на энергию дня/тенденцию, но без "100% будет".`;

  const resp = await openai.responses.create({
    model: OPENAI_MODEL,
    input: [
      { role: "system", content: sys },
      { role: "user", content: user },
    ],
    text: { format: { type: "json_object" } },
  });

  const raw = clean((resp as any).output_text || "");
  const obj = safeJsonParse<{ meaningRu: string; adviceRu: string }>(raw);

  if (!obj?.meaningRu || !obj?.adviceRu) {
    // fallback мягкий
    return {
      meaningRu: `«${opts.titleRu}» — это тонкий знак: сейчас важно беречь своё внутреннее равновесие и не торопить события.`,
      adviceRu: "Сделай один небольшой шаг в верном направлении — и остальное начнёт складываться само.",
    };
  }

  return { meaningRu: clean(obj.meaningRu), adviceRu: clean(obj.adviceRu) };
}

export async function generateSpreadReadingRu(opts: {
  spreadTitle: string;
  positions: string[];      // подписи позиций
  cardTitlesRu: string[];   // русские названия карт, по порядку
  tag?: "general" | "love" | "money" | "health";
}) {
  if (!process.env.OPENAI_API_KEY) {
    const lines = opts.positions.map((p, i) => `• ${p} — «${opts.cardTitlesRu[i] || "Карта"}»: мягкий намёк на важную деталь ситуации.`);
    return {
      interpretationRu: `✨ Расклад «${opts.spreadTitle}»\n\n${lines.join("\n")}\n\nМистический вывод: сейчас всё ведёт тебя к большей ясности и спокойной силе.`,
      adviceRu: "Сфокусируйся на одном шаге, который ты можешь сделать уже сегодня — остальное подтянется.",
    };
  }

  const sys =
    `Ты — опытный таролог. Пиши ТОЛЬКО на русском. ` +
    `Стиль: мистически-поэтично и одновременно поддерживающе, без драматизации. ` +
    `Никаких упоминаний ИИ, моделей, подсказок, промптов. ` +
    `Не используй латиницу. ` +
    `Не давай медицинских назначений и диагнозов. ` +
    `Ответ дай строго в JSON.`;

  const pairs = opts.positions.map((p, i) => `- ${p}: «${opts.cardTitlesRu[i] || "Карта"}»`).join("\n");

  const tagLine =
    opts.tag === "health"
      ? "Тема здоровья: трактуй бережно, как метафору состояния и привычек. В конце добавь мягкую оговорку, что это не заменяет врача."
      : opts.tag === "money"
      ? "Тема финансов: говори про установки, возможности, осторожность, конкретные шаги без обещаний."
      : opts.tag === "love"
      ? "Тема отношений: избегай категоричных приговоров, больше про чувства, границы, диалог."
      : "Тема общая: про путь, тенденции и выбор.";

  const user =
    `Сделай трактовку расклада «${opts.spreadTitle}».\n` +
    `${tagLine}\n\n` +
    `Позиции и карты:\n${pairs}\n\n` +
    `Верни JSON формата:\n` +
    `{ "interpretationRu": "...", "adviceRu": "..." }\n\n` +
    `Правила:\n` +
    `- interpretationRu: 8–14 предложений. Структура:\n` +
    `  1) Заголовок "✨ Расклад «...»"\n` +
    `  2) По каждой позиции отдельная строка "• Позиция — карта: трактовка"\n` +
    `  3) Короткий "Мистический вывод:" (1–2 предложения)\n` +
    `- adviceRu: 1–3 предложения, очень практично и бережно.\n`;

  const resp = await openai.responses.create({
    model: OPENAI_MODEL,
    input: [
      { role: "system", content: sys },
      { role: "user", content: user },
    ],
    text: { format: { type: "json_object" } },
  });

  const raw = clean((resp as any).output_text || "");
  const obj = safeJsonParse<{ interpretationRu: string; adviceRu: string }>(raw);

  if (!obj?.interpretationRu || !obj?.adviceRu) {
    const lines = opts.positions.map((p, i) => `• ${p} — «${opts.cardTitlesRu[i] || "Карта"}»: здесь спрятан ключ к твоей ситуации.`);
    return {
      interpretationRu: `✨ Расклад «${opts.spreadTitle}»\n\n${lines.join("\n")}\n\nМистический вывод: события ведут тебя к ясности и внутренней опоре.`,
      adviceRu: "Сделай паузу, собери мысли и выбери один честный шаг — он станет твоим талисманом.",
    };
  }

  return { interpretationRu: clean(obj.interpretationRu), adviceRu: clean(obj.adviceRu) };
}
