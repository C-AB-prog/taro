export default function Page() {
  return (
    <main style={{ padding: 24, fontFamily: "system-ui" }}>
      <h1 style={{ fontSize: 24, fontWeight: 700 }}>Карта Дня | Daily Tarot</h1>
      <p style={{ marginTop: 12 }}>
        Сервер ок: <a href="/api/health">/api/health</a>
      </p>
      <p style={{ marginTop: 8 }}>
        Карта дня: <a href="/api/daily-card">/api/daily-card</a>
      </p>
    </main>
  );
}
