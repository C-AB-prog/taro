"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";

export function Modal({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const [mounted, setMounted] = useState(false);
  const scrollTopRef = useRef(0);

  useEffect(() => setMounted(true), []);

  // lock background scroll
  useEffect(() => {
    if (!open) return;

    const body = document.body;
    const html = document.documentElement;

    const y = window.scrollY || 0;
    scrollTopRef.current = y;

    body.style.position = "fixed";
    body.style.top = `-${y}px`;
    body.style.left = "0";
    body.style.right = "0";
    body.style.width = "100%";

    html.classList.add("modalOpen");
    body.classList.add("modalOpen");

    return () => {
      html.classList.remove("modalOpen");
      body.classList.remove("modalOpen");

      const top = body.style.top;
      body.style.position = "";
      body.style.top = "";
      body.style.left = "";
      body.style.right = "";
      body.style.width = "";

      const restoreY = Math.abs(parseInt(top || "0", 10)) || scrollTopRef.current || 0;
      window.scrollTo(0, restoreY);
    };
  }, [open]);

  // ESC close
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            background: "rgba(0,0,0,.34)",
            backdropFilter: "blur(10px)",
            WebkitBackdropFilter: "blur(10px)",
            display: "grid",
            alignItems: "end",
            justifyItems: "center",
            padding: 12,
          }}
        >
          <motion.div
            initial={{ y: 24, opacity: 0, scale: 0.995 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 24, opacity: 0, scale: 0.995 }}
            transition={{ duration: 0.2 }}
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(640px, 100%)",
              maxHeight: "86vh",
              overflow: "hidden",
              borderRadius: 26,
              border: "1px solid rgba(176,142,66,.25)",
              background:
                "linear-gradient(180deg, rgba(255,255,255,.96), rgba(255,255,255,.90))",
              boxShadow: "0 28px 90px rgba(0,0,0,.18)",
            }}
          >
            {/* header */}
            <div
              style={{
                position: "sticky",
                top: 0,
                zIndex: 2,
                background:
                  "linear-gradient(180deg, rgba(255,255,255,.96), rgba(255,255,255,.86))",
                backdropFilter: "blur(10px)",
                WebkitBackdropFilter: "blur(10px)",
                padding: "12px 12px 10px 12px",
                borderBottom: "1px solid rgba(20,16,10,.10)",
              }}
            >
              {/* маленький “хэндл” */}
              <div
                aria-hidden="true"
                style={{
                  width: 44,
                  height: 5,
                  borderRadius: 999,
                  background: "rgba(20,16,10,.14)",
                  margin: "0 auto 10px",
                }}
              />

              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                <div style={{ fontWeight: 900, fontSize: 16, color: "var(--text)" }}>{title}</div>

                <button
                  type="button"
                  onClick={onClose}
                  className="btn btnGhost"
                  aria-label="Закрыть"
                  style={{
                    borderRadius: 999,
                    padding: "10px 12px",
                    display: "grid",
                    placeItems: "center",
                  }}
                >
                  ✕
                </button>
              </div>

              <div
                style={{
                  height: 1,
                  marginTop: 10,
                  background:
                    "linear-gradient(to right, rgba(176,142,66,0), rgba(176,142,66,.50), rgba(176,142,66,0))",
                }}
              />
            </div>

            {/* body scroll */}
            <div
              style={{
                padding: 12,
                overflowY: "auto",
                maxHeight: "calc(86vh - 74px)",
                WebkitOverflowScrolling: "touch",
                overscrollBehavior: "contain",
              }}
            >
              {children}
              <div style={{ height: 10 }} />
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body
  );
}
