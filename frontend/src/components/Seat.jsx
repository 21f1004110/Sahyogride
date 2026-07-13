const STATUS_STYLES = {
  available: { icon: "✓", classes: "bg-green-100 text-green-800 border-green-300" },
  held: { icon: "⏳", classes: "bg-amber-100 text-amber-800 border-amber-300" },
  reserved: { icon: "✕", classes: "bg-gray-200 text-gray-600 border-gray-300" },
};

export default function Seat({ seat }) {
  const { icon, classes } = STATUS_STYLES[seat.status] || STATUS_STYLES.available;
  const label = `Seat ${seat.seat_number}, ${seat.status}${seat.held_by_me ? " (held by you)" : ""}`;

  return (
    <div
      role="img"
      aria-label={label}
      title={label}
      className={`min-w-[44px] min-h-[44px] flex flex-col items-center justify-center rounded border text-sm font-medium ${classes} ${
        seat.held_by_me ? "ring-2 ring-blue-500" : ""
      }`}
    >
      <span aria-hidden="true">{icon}</span>
      <span className="text-xs">{seat.seat_number}</span>
    </div>
  );
}
