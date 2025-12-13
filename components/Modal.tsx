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

  // 🔒 lock background scroll while modal open
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
        >
          <motion.div
            className="modal"
            initial={{ y: 18, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 18, opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.18 }}
            onClick={(e) => e.stopPropagation()}
            // ✅ важно: разрешаем скролл внутри модалки
            style={{
              maxHeight: "86vh",
              overflowY: "auto",
              WebkitOverflowScrolling: "touch",
              overscrollBehavior: "contain",
            }}
          >
            <div
              className="row"
              style={{
                justifyContent: "space-between",
                alignItems: "center",
                position: "sticky",
                top: 0,
                background: "rgba(255,255,255,.92)",
                backdropFilter: "blur(10px)",
                zIndex: 2,
                paddingBottom: 10,
              }}
            >
              <div className="title" style={{ fontSize: 16 }}>
                {title}
              </div>
              <button
                className="btn btnGhost"
                style={{ padding: "10px 12px" }}
                onClick={onClose}
                type="button"
              >
                Закрыть
              </button>
            </div>

            {children}
            <div style={{ height: 8 }} />
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body
  );
}
