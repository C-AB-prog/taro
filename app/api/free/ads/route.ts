import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const rows = (await prisma.$queryRaw`
      SELECT "title", COALESCE("url",'') AS "url", COALESCE("username",'') AS "username"
      FROM "AdvertiserChannel"
      WHERE "isActive" = true
      ORDER BY "sort" ASC, "createdAt" DESC
      LIMIT 200
    `) as Array<{ title: string; url: string; username: string }>;

    const items = rows
      .map((r) => ({
        title: r.title,
        url: r.url ? r.url : (r.username ? `https://t.me/${r.username}` : ""),
        username: r.username || null,
      }))
      .filter((x) => !!x.url);

    return NextResponse.json({ ok: true, items }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    try {
      const rows2 = (await prisma.$queryRaw`
        SELECT "title","username"
        FROM "AdvertiserChannel"
        WHERE "isActive" = true
        ORDER BY "sort" ASC, "createdAt" DESC
        LIMIT 200
      `) as Array<{ title: string; username: string }>;

      return NextResponse.json(
        {
          ok: true,
          items: rows2.map((r) => ({
            title: r.title,
            url: `https://t.me/${r.username}`,
            username: r.username,
          })),
        },
        { headers: { "Cache-Control": "no-store" } }
      );
    } catch {
      return NextResponse.json({ ok: true, items: [] }, { headers: { "Cache-Control": "no-store" } });
    }
  }
}
