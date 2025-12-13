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

  // 🔒 lock background scroll while modal is open
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
          className="modalOverlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            background: "rgba(0,0,0,.38)",
            backdropFilter: "blur(10px)",
            WebkitBackdropFilter: "blur(10px)",
            display: "grid",
            placeItems: "center",
            padding: 14,
          }}
        >
          <motion.div
            className="modal"
            initial={{ y: 16, opacity: 0, scale: 0.985 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 16, opacity: 0, scale: 0.985 }}
            transition={{ duration: 0.18 }}
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(560px, 100%)",
              maxHeight: "86vh",
              overflowY: "auto",
              WebkitOverflowScrolling: "touch",
              overscrollBehavior: "contain",
              borderRadius: 24,
              background: "rgba(255,255,255,.92)",
              border: "1px solid rgba(20,16,10,.10)",
              boxShadow: "0 26px 80px rgba(0,0,0,.18)",
              padding: 14,
            }}
          >
            {/* Header */}
            <div
              style={{
                position: "sticky",
                top: 0,
                zIndex: 2,
                background: "rgba(255,255,255,.88)",
                backdropFilter: "blur(10px)",
                WebkitBackdropFilter: "blur(10px)",
                paddingBottom: 10,
              }}
            >
              <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                <div className="title" style={{ fontSize: 16 }}>
                  {title}
                </div>

                <button
                  type="button"
                  className="btn btnGhost"
                  onClick={onClose}
                  aria-label="Закрыть"
                  style={{
                    padding: "10px 12px",
                    borderRadius: 999,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <span style={{ fontSize: 16, lineHeight: 1 }}>✕</span>
                </button>
              </div>
              <div
                style={{
                  height: 1,
                  marginTop: 10,
                  background: "linear-gradient(to right, rgba(176,142,66,.0), rgba(176,142,66,.45), rgba(176,142,66,.0))",
                }}
              />
            </div>

            <div style={{ height: 10 }} />
            {children}
            <div style={{ height: 8 }} />
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body
  );
}
