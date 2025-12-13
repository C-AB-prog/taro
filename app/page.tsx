"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { AppShell } from "@/components/AppShell";
import { Wheel } from "@/components/Wheel";
import { FlipCard } from "@/components/FlipCard";
import { RitualHeader } from "@/components/RitualHeader";
import { ruTitleFromSlug } from "@/lib/ruTitles";

type Card = { slug: string; titleRu: string; meaningRu: string; adviceRu: string; image: string };

export default function HomePage() {
  const [daily, setDaily] = useState<Card | null>(null);

  useEffect(() => {
    fetch("/api/daily-card", { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setDaily(d.card));
  }, []);

  const dailyTitle = daily ? (ruTitleFromSlug(daily.slug) || daily.titleRu) : "";

  return (
    <AppShell title="Главная">
      <h1 className="h1">Твой день</h1>
      <RitualHeader label="Сегодняшний знак" />

      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="card"
      >
        <div className="title">Карта дня</div>
        <div className="small" style={{ marginTop: 4 }}>
          Одна карта для всех — но отклик всегда личный.
        </div>

        <div style={{ height: 12 }} />

        {!daily ? (
          <div className="row">
            <div className="shimmer" style={{ width: 96, height: 156, borderRadius: 14 }} />
            <div className="col">
              <div className="shimmer" style={{ height: 16, width: "60%" }} />
              <div className="shimmer" style={{ height: 12, width: "92%" }} />
              <div className="shimmer" style={{ height: 12, width: "86%" }} />
              <div style={{ height: 6 }} />
              <div className="shimmer" style={{ height: 12, width: "55%" }} />
              <div className="shimmer" style={{ height: 12, width: "80%" }} />
            </div>
          </div>
        ) : (
          <div className="row">
            <div>
              <FlipCard
                frontSrc={daily.image}
                backSrc={"/cards/card-back.jpg"}
                alt={dailyTitle}
                startSide="back"
                allowFlipBack={true}
              />
              <div className="flipHint">Нажми, чтобы открыть</div>
            </div>

            <div className="col">
              <div>
                <div className="title" style={{ fontSize: 16 }}>
                  {dailyTitle}
                </div>
                <p className="text" style={{ marginTop: 6 }}>
                  {daily.meaningRu}
                </p>
              </div>

              <div>
                <div className="small">
                  <b>Совет</b>
                </div>
                <p className="text" style={{ marginTop: 6 }}>
                  {daily.adviceRu}
                </p>
              </div>
            </div>
          </div>
        )}
      </motion.div>

      <div style={{ height: 12 }} />

      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.05 }}
      >
        <Wheel />
      </motion.div>
    </AppShell>
  );
}
