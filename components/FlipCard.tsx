"use client";

import { useState } from "react";
import { motion } from "framer-motion";

type Side = "front" | "back";

export function FlipCard({
  frontSrc,
  backSrc,
  alt,
  startSide = "front",
  allowFlipBack = true,
  disabled = false,
  width = 96,
  height = 156,
  onRevealed,
}: {
  frontSrc: string;
  backSrc: string;
  alt: string;
  startSide?: Side;
  allowFlipBack?: boolean;
  disabled?: boolean;
  width?: number;
  height?: number;
  onRevealed?: () => void;
}) {
  const [side, setSide] = useState<Side>(startSide);

  function flip() {
    if (disabled) return;

    // back -> front (reveal)
    if (side === "back") {
      setSide("front");
      window.Telegram?.WebApp?.HapticFeedback?.impactOccurred?.("soft");
      onRevealed?.();
      return;
    }

    // front -> back (optional)
    if (allowFlipBack) {
      setSide("back");
      window.Telegram?.WebApp?.HapticFeedback?.selectionChanged?.();
    }
  }

  const rotateY = side === "back" ? 180 : 0;

  return (
    <button
      onClick={flip}
      style={{
        all: "unset",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.55 : 1,
        filter: disabled ? "grayscale(0.2)" : "none",
      }}
      aria-label="Перевернуть карту"
    >
      <div className="flipWrap" style={{ width, height }}>
        <motion.div
          className="flipInner"
          animate={{ rotateY }}
          transition={{ duration: 0.55, ease: [0.2, 0.9, 0.2, 1] }}
        >
          {/* FRONT */}
          <div className="flipFace">
            <img src={frontSrc} alt={alt} loading="lazy" />
            <motion.div
              className="flipShine"
              animate={{ x: side === "back" ? "40%" : "-30%" }}
              transition={{ duration: 0.9, ease: "easeOut" }}
            />
          </div>

          {/* BACK */}
          <div className="flipFace flipBack">
            <img src={backSrc} alt="Рубашка карты" loading="lazy" />
            <motion.div
              className="flipShine"
              animate={{ x: side === "back" ? "-25%" : "35%" }}
              transition={{ duration: 0.9, ease: "easeOut" }}
            />
          </div>
        </motion.div>
      </div>
    </button>
  );
}
