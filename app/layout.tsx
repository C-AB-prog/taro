import "./globals.css";
import Script from "next/script";

export const metadata = {
  title: "Daily Tarot",
  description: "Карта дня — Telegram Mini App",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru">
      <head>
        {/* ОБЯЗАТЕЛЬНО: Telegram WebApp API */}
        <Script
          src="https://telegram.org/js/telegram-web-app.js"
          strategy="beforeInteractive"
        />
      </head>

      <body>
        {children}
      </body>
    </html>
  );
}
