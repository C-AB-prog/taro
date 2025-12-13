import "server-only";
import { z } from "zod";
import { openai, OPENAI_MODEL } from "@/lib/openai.server";

const CardSchema = z.object({
  meaningRu: z.string().min(10),
  adviceRu: z.string().min(10),
});

const SpreadSchema = z.object({
  interpretationRu: z.string().min(10),
  adviceRu: z.string().min(10),
});

function clean(s: unknown) {
  return String(s ?? "").trim();
}

function safeJson(raw: string) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function generateCardReadingRu(opts: {
  titleRu: string;
  kind: "daily" | "wheel";
}): Promise<{ meaningRu: string; adviceRu: string; _source: "ai" | "fallback" }> {
  if (!process.env.OPENAI_API_KEY) {
    return {
      meaningRu: `«${opts.titleRu}» — знак дня: многое проясняется мягко и постепенно.`,
      adviceRu: "Не торопи события: сделай один спокойный шаг и прислушайся к ощущениям.",
      _source: "fallback",
    };
  }

  const system =
    `Ты — опытный таролог. Пиши ТОЛЬКО по-русски. ` +
    `Стиль: мягко, поддерживающе, мистически-поэтично. ` +
    `Никаких упоминаний ИИ/моделей/подсказок/промптов. ` +
    `Не используй латиницу.`;

  const user =
    `Сделай трактовку для ${opts.kind === "daily" ? "«Карты дня»" : "«Колеса фортуны»"}.\n` +
    `Карта: «${opts.titleRu}».\n\n` +
    `Верни СТРОГО JSON-объект:\n` +
    `{ "meaningRu": "...", "adviceRu": "..." }\n\n` +
    `Правила:\n` +
    `- meaningRu: 2–4 предложения, без запугивания и приговоров.\n` +
    `- adviceRu: 1–2 предложения, конкретно и бережно.\n` +
    `- Не повторяй одинаковыми словами для разных карт.\n`;

  try {
    const resp = await openai.responses.create({
      model: OPENAI_MODEL,
      input: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      text: { format: { type: "json_object" } },
    });

    const raw = clean((resp as any).output_text || "");
    const obj = safeJson(raw);
    const parsed = CardSchema.safeParse(obj);

    if (!parsed.success) throw new Error("BAD_JSON");

    return {
      meaningRu: clean(parsed.data.meaningRu),
      adviceRu: clean(parsed.data.adviceRu),
      _source: "ai",
    };
  } catch {
    return {
      meaningRu: `«${opts.titleRu}» — тонкий знак: сейчас важно беречь внутреннее равновесие и не торопить развязку.`,
      adviceRu: "Сделай один небольшой шаг туда, где ощущается больше спокойствия.",
      _source: "fallback",
    };
  }
}

export async function generateSpreadReadingRu(opts: {
  spreadTitle: string;
  positions: string[];
  cardTitlesRu: string[];
  tag?: "general" | "love" | "money" | "health";
}): Promise<{ interpretationRu: string; adviceRu: string; _source: "ai" | "fallback" }> {
  if (!process.env.OPENAI_API_KEY) {
    const lines = opts.positions
      .map((p, i) => `• ${p} — «${opts.cardTitlesRu[i] || "Карта"}»: здесь спрятан важный ключ.`)
      .join("\n");

    return {
      interpretationRu: `✨ Расклад «${opts.spreadTitle}»\n\n${lines}\n\nМистический вывод: всё ведёт тебя к большей ясности и внутренней опоре.`,
      adviceRu: "Выбери один практичный шаг на сегодня — и сделай его спокойно, без давления.",
      _source: "fallback",
    };
  }

  const tagLine =
    opts.tag === "health"
      ? "Тема здоровья: трактуй бережно, без диагнозов и назначений. В конце добавь мягкую оговорку, что это не заменяет врача."
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
    `Никаких упоминаний ИИ/моделей/подсказок/промптов. ` +
    `Не используй латиницу.`;

  const user =
    `Сделай трактовку расклада «${opts.spreadTitle}».\n${tagLine}\n\n` +
    `Позиции и карты:\n${pairs}\n\n` +
    `Верни СТРОГО JSON-объект:\n` +
    `{ "interpretationRu": "...", "adviceRu": "..." }\n\n` +
    `Правила:\n` +
    `- interpretationRu: заголовок + строки по позициям "• Позиция — карта: ...", затем "Мистический вывод: ...".\n` +
    `- adviceRu: 1–3 предложения, практично и бережно.\n` +
    `- Не повторяй одинаковую фразу для разных позиций.\n`;

  try {
    const resp = await openai.responses.create({
      model: OPENAI_MODEL,
      input: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      text: { format: { type: "json_object" } },
    });

    const raw = clean((resp as any).output_text || "");
    const obj = safeJson(raw);
    const parsed = SpreadSchema.safeParse(obj);

    if (!parsed.success) throw new Error("BAD_JSON");

    return {
      interpretationRu: clean(parsed.data.interpretationRu),
      adviceRu: clean(parsed.data.adviceRu),
      _source: "ai",
    };
  } catch {
    const lines = opts.positions
      .map((p, i) => `• ${p} — «${opts.cardTitlesRu[i] || "Карта"}»: здесь спрятан важный ключ.`)
      .join("\n");

    return {
      interpretationRu: `✨ Расклад «${opts.spreadTitle}»\n\n${lines}\n\nМистический вывод: события ведут тебя к ясности и спокойной силе.`,
      adviceRu: "Сделай паузу, выдохни и выбери один честный шаг — он станет твоей опорой.",
      _source: "fallback",
    };
  }
}
