export type PackId = "pack_99" | "pack_199" | "pack_399" | "pack_799";

export const SHOP_PACKS: Record<
  PackId,
  { id: PackId; stars: number; coins: number; title: string; desc: string }
> = {
  pack_99:  { id: "pack_99",  stars: 99,  coins: 150,  title: "150 валюты",  desc: "Быстрый пополнить запас" },
  pack_199: { id: "pack_199", stars: 199, coins: 350,  title: "350 валюты",  desc: "Самый популярный" },
  pack_399: { id: "pack_399", stars: 399, coins: 800,  title: "800 валюты",  desc: "Выгодно для раскладов" },
  pack_799: { id: "pack_799", stars: 799, coins: 1800, title: "1800 валюты", desc: "Максимум выгоды" },
};

export function isPackId(x: any): x is PackId {
  return x && typeof x === "string" && x in SHOP_PACKS;
}

export function makePayload(opts: { userId: string; packId: PackId }) {
  // payload должен быть 1-128 байт (требование Bot API) :contentReference[oaicite:2]{index=2}
  const rnd = Math.random().toString(36).slice(2, 10);
  return `topup:${opts.userId}:${opts.packId}:${Date.now()}:${rnd}`.slice(0, 120);
}

export function parsePayload(payload: string) {
  const p = String(payload || "");
  const parts = p.split(":");
  if (parts.length < 3) return null;
  if (parts[0] !== "topup") return null;
  const userId = parts[1];
  const packId = parts[2] as PackId;
  return { userId, packId };
}
