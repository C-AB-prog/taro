"use client";

import { motion } from "framer-motion";

export function LoadingScreen() {
  return (
    <div className="container" style={{ paddingTop: 64 }}>
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="card"
      >
        <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div className="title" style={{ fontSize: 18 }}>Подключаем магию…</div>
            <div className="small" style={{ marginTop: 6 }}>Секунду — открываем твой дневной знак.</div>
          </div>
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
            style={{
              width: 34,
              height: 34,
              borderRadius: 999,
              border: "2px solid rgba(255,255,255,.25)",
              borderTopColor: "rgba(255,255,255,.9)",
            }}
          />
        </div>

        <hr className="hr" />

        <div className="row">
          <div className="shimmer" style={{ width: 96, height: 156 }} />
          <div className="col">
            <div className="shimmer" style={{ height: 16, width: "65%" }} />
            <div className="shimmer" style={{ height: 12, width: "95%" }} />
            <div className="shimmer" style={{ height: 12, width: "88%" }} />
            <div style={{ height: 6 }} />
            <div className="shimmer" style={{ height: 12, width: "55%" }} />
            <div className="shimmer" style={{ height: 12, width: "82%" }} />
          </div>
        </div>
      </motion.div>
    </div>
  );
}
