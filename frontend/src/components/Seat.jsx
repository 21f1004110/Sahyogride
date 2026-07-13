export const STATUS_STYLES = {
  available: {
    icon: "✓",
    label: "Available",
    classes: "bg-green-100 text-green-800 border-green-300",
  },
  held: {
    icon: "⏳",
    label: "Held by someone",
    classes: "bg-amber-100 text-amber-800 border-amber-300",
  },
  reserved: {
    icon: "✕",
    label: "Reserved",
    classes: "bg-gray-200 text-gray-600 border-gray-300",
  },
};

export default function Seat({ seat, onClick }) {
  const { icon, classes } = STATUS_STYLES[seat.status] || STATUS_STYLES.available;
  const label = `Seat ${seat.seat_number}, ${seat.status}${seat.held_by_me ? " (held by you)" : ""}`;
  const clickable = seat.status === "available" && typeof onClick === "function";

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={!clickable}
      onClick={clickable ? () => onClick(seat) : undefined}
      className={`min-w-[44px] min-h-[44px] flex flex-col items-center justify-center rounded-xl border text-sm font-medium transition ${classes} ${
        seat.held_by_me ? "ring-2 ring-primary-500" : ""
      } ${clickable ? "cursor-pointer hover:scale-105 hover:shadow-sm" : "cursor-default"}`}
    >
      <span aria-hidden="true">{icon}</span>
      <span className="text-xs">{seat.seat_number}</span>
    </button>
  );
}
