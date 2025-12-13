"use client";

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
  if (!open) return null;
  return (
    <div className="modalOverlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
          <div className="title">{title}</div>
          <button className="btn btnGhost" onClick={onClose}>Закрыть</button>
        </div>
        <hr className="hr" />
        {children}
      </div>
    </div>
  );
}
