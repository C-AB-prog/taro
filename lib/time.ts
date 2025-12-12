export function todayKey(): Date {
  // День считаем по МСК (UTC+3). Хранится как "дата-ключ" в UTC 00:00.
  const now = new Date();
  const ms = now.getTime() + 3 * 60 * 60 * 1000; // UTC+3
  const msk = new Date(ms);
  return new Date(Date.UTC(msk.getUTCFullYear(), msk.getUTCMonth(), msk.getUTCDate()));
}
