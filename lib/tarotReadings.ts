import "server-only";
import { z } from "zod";
import { zodTextFormat } from "openai/helpers/zod";
import { openai, OPENAI_MODEL } from "@/lib/openai.server";

const CardSchema = z.object({
  meaningRu: z.string(),
  adviceRu: z.string(),
});

const SpreadSchema = z.object({
  interpretationRu: z.string(),
  adviceRu: z.string(),
});

function clean(s: unknown) {
  return String(s ?? "").trim();
}

export async function generateCardReadingRu(opts: {
  titleRu: string;
  kind: "daily" | "wheel";
}) {
  // fallback (если ключ не задан)
  if (!process.env.OPENAI_API_KEY) {
    return {
      meaningRu: `«${opts.titleRu}» — знак дня: многое проясняется мягко и постепенно.`,
      adviceRu: "Не торопи события: сделай один спокойный шаг и прислушайся к ощущениям.",
    };
  }

  const system =
    `Ты — опытный таролог. Пиши ТОЛЬКО по-русски. ` +
    `Стиль: мягко, поддерживающе, мистически-поэтично. ` +
    `Никаких упоминаний ИИ/моделей/подсказок. ` +
    `Не используй латиницу (если название вдруг с латиницей — перепиши по-русски).`;

  const user =
    `Сделай трактовку для ${opts.kind === "daily" ? "«Карты дня»" : "«Колеса фортуны»"}.\n` +
    `Карта: «${opts.titleRu}».\n\n` +
    `Верни JSON:\n{ "meaningRu": "...", "adviceRu": "..." }\n\n` +
    `Правила:\n` +
    `- meaningRu: 2–4 предложения, без запугивания и приговоров.\n` +
    `- adviceRu: 1–2 предложения, конкретно и бережно.\n`;

  try {
    const resp = await openai.responses.parse({
      model: OPENAI_MODEL,
      input: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      text: { format: zodTextFormat(CardSchema, "card_reading") },
    });

    const parsed = resp.output_parsed;
    if (!parsed) throw new Error("NO_PARSED_OUTPUT");

    return {
      meaningRu: clean(parsed.meaningRu),
      adviceRu: clean(parsed.adviceRu),
    };
  } catch {
    return {
      meaningRu: `«${opts.titleRu}» — тонкий знак: сейчас важно беречь внутреннее равновесие и не торопить развязку.`,
      adviceRu: "Сделай один небольшой шаг туда, где ощущается больше спокойствия.",
    };
  }
}

export async function generateSpreadReadingRu(opts: {
  spreadTitle: string;
  positions: string[];
  cardTitlesRu: string[];
  tag?: "general" | "love" | "money" | "health";
}) {
  if (!process.env.OPENAI_API_KEY) {
    const lines = opts.positions
      .map((p, i) => `• ${p} — «${opts.cardTitlesRu[i] || "Карта"}»: здесь спрятан важный ключ.`)
      .join("\n");

    return {
      interpretationRu: `✨ Расклад «${opts.spreadTitle}»\n\n${lines}\n\nМистический вывод: всё ведёт тебя к большей ясности и внутренней опоре.`,
      adviceRu: "Выбери один практичный шаг на сегодня — и сделай его спокойно, без давления.",
    };
  }

  const tagLine =
    opts.tag === "health"
      ? "Тема здоровья: трактуй бережно, без диагнозов. В конце добавь мягкую оговорку, что это не заменяет врача."
      : opts.tag === "money"
      ? "Тема финансов: говори про установки, осторожность, возможности и реальные шаги, без обещаний."
      : opts.tag === "love"
      ? "Тема отношений: без приговоров, больше про чувства, границы и диалог."
      : "Тема общая: тенденции, выбор и путь.";

  const pairs = opts.positions
    .map((p, i) => `- ${p}: «${opts.cardTitlesRu[i] || "Карта"}»`)
    .join("\n");

  const system =
    `Ты — опытный таролог. Пиши ТОЛЬКО по-русски. ` +
    `Стиль: мистически-поэтично и поддерживающе. ` +
    `Никаких упоминаний ИИ/моделей/подсказок. ` +
    `Не используй латиницу. ` +
    `Не ставь диагнозы и не назначай лечение.`;

  const user =
    `Сделай трактовку расклада «${opts.spreadTitle}».\n${tagLine}\n\n` +
    `Позиции и карты:\n${pairs}\n\n` +
    `Верни JSON:\n{ "interpretationRu": "...", "adviceRu": "..." }\n\n` +
    `Правила:\n` +
    `- interpretationRu: заголовок + строки по позициям вида "• Позиция — карта: ...", затем "Мистический вывод: ...".\n` +
    `- adviceRu: 1–3 предложения, практично и бережно.\n`;

  try {
    const resp = await openai.responses.parse({
      model: OPENAI_MODEL,
      input: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      text: { format: zodTextFormat(SpreadSchema, "spread_reading") },
    });

    const parsed = resp.output_parsed;
    if (!parsed) throw new Error("NO_PARSED_OUTPUT");

    return {
      interpretationRu: clean(parsed.interpretationRu),
      adviceRu: clean(parsed.adviceRu),
    };
  } catch {
    const lines = opts.positions
      .map((p, i) => `• ${p} — «${opts.cardTitlesRu[i] || "Карта"}»: здесь спрятан важный ключ.`)
      .join("\n");

    return {
      interpretationRu: `✨ Расклад «${opts.spreadTitle}»\n\n${lines}\n\nМистический вывод: события ведут тебя к ясности и спокойной силе.`,
      adviceRu: "Сделай паузу, выдохни и выбери один честный шаг — он станет твоей опорой.",
    };
  }
}
