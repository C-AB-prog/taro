import "server-only";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

export async function tgCall<T = any>(method: string, body: any): Promise<T> {
  if (!BOT_TOKEN) throw new Error("NO_TELEGRAM_BOT_TOKEN");

  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => null);
  if (!data?.ok) {
    throw new Error(data?.description || `TG_${method}_FAILED`);
  }
  return data.result as T;
}
