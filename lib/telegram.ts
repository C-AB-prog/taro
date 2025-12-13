import crypto from "crypto";

export function verifyTelegramInitData(
  initData: string,
  botToken: string
): { ok: boolean; data?: Record<string, string> } {
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) return { ok: false };

  params.delete("hash");

  const pairs: string[] = [];
  Array.from(params.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([k, v]) => pairs.push(`${k}=${v}`));

  const dataCheckString = pairs.join("\n");

  // secret_key = HMAC_SHA256(<bot_token>, "WebAppData")  (по смыслу: key="WebAppData", msg=botToken)
  const secretKey = crypto.createHmac("sha256", "WebAppData").update(botToken).digest();

  const computedHash = crypto
    .createHmac("sha256", secretKey)
    .update(dataCheckString)
    .digest("hex");

  if (computedHash !== hash) return { ok: false };

  const data: Record<string, string> = {};
  for (const [k, v] of params.entries()) data[k] = v;

  return { ok: true, data };
}
