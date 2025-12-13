import { NextResponse } from "next/server";
import { openai, OPENAI_MODEL } from "@/lib/openai.server";

export const runtime = "nodejs";

export async function GET() {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ ok: false, error: "NO_OPENAI_API_KEY" }, { status: 500 });
    }

    const r = await openai.responses.create({
      model: OPENAI_MODEL,
      input: "Ответь одним уникальным предложением на русском: «Связь с Оракулом установлена» (перефразируй).",
    });

    return NextResponse.json({
      ok: true,
      model: OPENAI_MODEL,
      text: (r as any).output_text ?? null,
    });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, model: OPENAI_MODEL, error: e?.message ?? String(e) },
      { status: 500 }
    );
  }
}
