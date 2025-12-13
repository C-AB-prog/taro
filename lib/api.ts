export function getTgInitData(): string {
  const tg = (globalThis as any)?.Telegram?.WebApp;
  return (tg?.initData && String(tg.initData)) || "";
}

function withTgHeaders(headers?: HeadersInit): HeadersInit {
  const initData = getTgInitData();
  return {
    ...(headers ?? {}),
    // самые распространённые варианты
    "x-telegram-init-data": initData,
    "x-telegram-webapp-init-data": initData,
  };
}

export async function apiJson(
  url: string,
  opts?: RequestInit
): Promise<{ ok: boolean; status: number; data: any }> {
  const r = await fetch(url, {
    ...opts,
    headers: withTgHeaders(opts?.headers),
    credentials: "include",
    cache: "no-store",
  });

  const data = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, data };
}

export async function apiGetOrPostFirst(urls: string[]) {
  for (const u of urls) {
    // пробуем GET
    const g = await apiJson(u, { method: "GET" });
    if (g.status !== 404 && g.status !== 405) return g;
    if (g.ok) return g;

    // если Method Not Allowed — пробуем POST
    if (g.status === 405) {
      const p = await apiJson(u, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" });
      if (p.status !== 404) return p;
    }
  }
  return { ok: false, status: 404, data: { error: "NOT_FOUND" } };
}

export async function apiPostTryBodies(
  url: string,
  bodies: any[]
): Promise<{ ok: boolean; status: number; data: any }> {
  for (const b of bodies) {
    const res = await apiJson(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(b ?? {}),
    });
    // если эндпоинта нет — смысла дальше нет
    if (res.status === 404) return res;
    if (res.ok) return res;
  }
  return { ok: false, status: 400, data: { error: "BUY_FAILED" } };
}
