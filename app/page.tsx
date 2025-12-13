"use client";

import { useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { RitualHeader } from "@/components/RitualHeader";
import { Wheel } from "@/components/Wheel";
import { ruTitleFromSlug } from "@/lib/ruTitles";
import { cardImage } from "@/lib/deck";
import { pickDailySlug, todayRu, dailyTexts } from "@/lib/dailyLocal";

type DailyCard = {
  slug: string;
  image: string;
  titleRu: string;
  meaningRu: string;
  adviceRu: string;
};

export default function HomePage() {
  const [flipped, setFlipped] = useState(false);

  const daily = useMemo<DailyCard>(() => {
    const slug = pickDailySlug();
    const titleRu = ruTitleFromSlug(slug);
    const { meaningRu, adviceRu } = dailyTexts(titleRu, slug);

    return {
      slug,
      image: cardImage(slug),
      titleRu,
      meaningRu,
      adviceRu,
    };
  }, []);

  function onFlip() {
    setFlipped(true);
    window.Telegram?.WebApp?.HapticFeedback?.impactOccurred?.("light");
  }

  return (
    <AppShell>
      <RitualHeader label="Твой знак на сегодня" />

      <div className="card">
        <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline" }}>
          <div>
            <div className="title">Карта дня</div>
            <div className="small">Сегодня: {todayRu()} • карта общая для всех</div>
          </div>

          <div className="small">{flipped ? "Открыто" : "Нажми на карту"}</div>
        </div>

        <div style={{ height: 12 }} />

        <div className="row">
          <button
            className="pressable"
            onClick={onFlip}
            style={{ border: "none", background: "transparent", padding: 0, cursor: "pointer" }}
            aria-label="Открыть карту дня"
          >
            <div className="flipWrap">
              <div
                className="flipInner"
                style={{
                  transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
                  transition: "transform 700ms cubic-bezier(.2,.7,.2,1)",
                }}
              >
                <div className="flipFace">
                  <img src="/cards/card-back.jpg" alt="Рубашка" loading="lazy" decoding="async" />
                  <div className="flipShine" />
                </div>

                <div className="flipFace flipBack">
                  <img src={daily.image} alt={daily.titleRu} loading="lazy" decoding="async" />
                </div>
              </div>
            </div>

            <div className="flipHint">{flipped ? "Твоя карта" : "Нажми, чтобы открыть"}</div>
          </button>

          <div className="col">
            <div className="title" style={{ fontSize: 16 }}>
              {flipped ? daily.titleRu : "…"}
            </div>

            <div className="small" style={{ marginTop: 2 }}>
              {flipped ? "Что означает" : "Открой карту — и увидишь смысл"}
            </div>

            {flipped ? (
              <>
                <p className="text" style={{ marginTop: 6 }}>
                  {daily.meaningRu}
                </p>

                <div className="adviceBox" style={{ marginTop: 12 }}>
                  <div className="adviceTitle">Совет</div>
                  <div className="adviceText">{daily.adviceRu}</div>
                </div>
              </>
            ) : null}
          </div>
        </div>
      </div>

      <div style={{ height: 12 }} />

      <Wheel />
    </AppShell>
  );
}
