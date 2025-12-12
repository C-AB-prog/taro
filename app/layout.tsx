import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Карта Дня | Daily Tarot"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
