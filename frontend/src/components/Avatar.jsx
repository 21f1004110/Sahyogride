const PALETTE = [
  "bg-primary-100 text-primary-700",
  "bg-brand-100 text-brand-700",
  "bg-amber-100 text-amber-700",
  "bg-green-100 text-green-700",
];

function initials(name) {
  return name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export default function Avatar({ name, index = 0 }) {
  return (
    <div
      aria-hidden="true"
      className={`w-12 h-12 shrink-0 rounded-full flex items-center justify-center font-heading font-bold ${PALETTE[index % PALETTE.length]}`}
    >
      {initials(name)}
    </div>
  );
}
