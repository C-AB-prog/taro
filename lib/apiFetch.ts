// lib/apiFetch.ts
export function getTgInitData(): string {
  try {
    const tg = (globalThis as any)?.Telegram?.WebApp;
    const initData = tg?.initData;
    return typeof initData === "string" ? initData : "";
  } catch {
    return "";
  }
}

export async function apiFetch(input: RequestInfo, init: RequestInit = {}) {
  const initData = getTgInitData();

  const headers = new Headers(init.headers || {});
  if (initData) headers.set("x-telegram-init-data", initData);

  // важно: чтобы куки тоже работали, если они есть
  return fetch(input, {
    ...init,
    headers,
    credentials: "include",
    cache: "no-store",
  });
}
