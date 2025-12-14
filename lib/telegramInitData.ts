// lib/telegramInitData.ts
import crypto from "crypto";

export type TgWebAppUser = {
  id: number;
  username?: string;
  first_name?: string;
};

export function verifyTelegramInitData(initData: string, botToken: string) {
  if (!initData || !botToken) return { ok: false as const };

  const sp = new URLSearchParams(initData);
  const hash = sp.get("hash") || "";
  if (!hash) return { ok: false as const };

  const pairs: string[] = [];
  sp.forEach((value, key) => {
    if (key === "hash") return;
    pairs.push(`${key}=${value}`);
  });
  pairs.sort();
  const dataCheckString = pairs.join("\n");

  const secretKey = crypto.createHmac("sha256", "WebAppData").update(botToken).digest();
  const computedHash = crypto.createHmac("sha256", secretKey).update(dataCheckString).digest("hex");

  if (computedHash !== hash) return { ok: false as const };

  let user: TgWebAppUser | null = null;
  const userRaw = sp.get("user");
  if (userRaw) {
    try {
      user = JSON.parse(userRaw);
    } catch {
      user = null;
    }
  }

  const startParam = sp.get("start_param") || "";

  return { ok: true as const, user, startParam };
}
