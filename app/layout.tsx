import "./globals.css";
import Script from "next/script";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Карта Дня | Daily Tarot",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <head>
        <Script
          src="https://telegram.org/js/telegram-web-app.js"
          strategy="beforeInteractive"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
