export function RitualHeader({ label }: { label: string }) {
  return (
    <div className="ritualLine">
      <span className="ritualDot" />
      <span style={{ fontSize: 12, fontWeight: 950, letterSpacing: ".2px" }}>{label}</span>
    </div>
  );
}
