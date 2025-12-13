"use client";

import { useState } from "react";
import { motion } from "framer-motion";

export function FlipCard({
  frontSrc,
  backSrc,
  alt,
  onRevealed,
}: {
  frontSrc: string;
  backSrc: string;
  alt: string;
  onRevealed?: () => void;
}) {
  const [flipped, setFlipped] = useState(false);

  function flip() {
    const next = !flipped;
    setFlipped(next);
    if (next) {
      window.Telegram?.WebApp?.HapticFeedback?.impactOccurred?.("soft");
      onRevealed?.();
    } else {
      window.Telegram?.WebApp?.HapticFeedback?.selectionChanged?.();
    }
  }

  return (
    <button
      onClick={flip}
      style={{ all: "unset", cursor: "pointer" }}
      aria-label="Перевернуть карту"
    >
      <div className="flipWrap">
        <motion.div
          className="flipInner"
          animate={{ rotateY: flipped ? 180 : 0 }}
          transition={{ duration: 0.55, ease: [0.2, 0.9, 0.2, 1] }}
        >
          {/* FRONT */}
          <div className="flipFace">
            <img src={frontSrc} alt={alt} loading="lazy" />
            <motion.div
              className="flipShine"
              animate={{ x: flipped ? "40%" : "-30%" }}
              transition={{ duration: 0.9, ease: "easeOut" }}
            />
          </div>

          {/* BACK */}
          <div className="flipFace flipBack">
            <img src={backSrc} alt="Рубашка карты" loading="lazy" />
            <motion.div
              className="flipShine"
              animate={{ x: flipped ? "-25%" : "35%" }}
              transition={{ duration: 0.9, ease: "easeOut" }}
            />
          </div>
        </motion.div>
      </div>
    </button>
  );
}
