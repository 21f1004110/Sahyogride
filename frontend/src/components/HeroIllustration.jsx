import { motion, useReducedMotion } from "framer-motion";

export default function HeroIllustration() {
  const reduceMotion = useReducedMotion();

  return (
    <svg
      viewBox="0 0 420 320"
      role="img"
      aria-label="Illustration of a community shuttle with a seat map and route line"
      className="w-full h-auto"
    >
      <defs>
        <linearGradient id="vanBody" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#6366F1" />
          <stop offset="1" stopColor="#7C3AED" />
        </linearGradient>
      </defs>

      {/* route line */}
      <motion.path
        d="M20 260 C 120 260, 140 160, 220 150 S 340 90, 400 60"
        fill="none"
        stroke="#C4B5FD"
        strokeWidth="6"
        strokeLinecap="round"
        strokeDasharray="2 16"
        initial={reduceMotion ? false : { pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1.6, ease: "easeInOut" }}
      />
      <motion.circle
        cx="400"
        cy="60"
        fill="#7C3AED"
        initial={reduceMotion ? false : { r: 0 }}
        animate={reduceMotion ? { r: 10 } : { r: [10, 13, 10] }}
        transition={
          reduceMotion
            ? { duration: 0.4, delay: 1.5 }
            : { r: { duration: 2, repeat: Infinity, ease: "easeInOut", delay: 1.6 } }
        }
      />
      <circle cx="400" cy="60" r="4" fill="white" />

      {/* shuttle body */}
      <rect x="30" y="150" width="220" height="100" rx="24" fill="url(#vanBody)" />
      <rect x="30" y="120" width="140" height="60" rx="20" fill="url(#vanBody)" />

      {/* windows */}
      <rect x="48" y="132" width="34" height="30" rx="8" fill="#EEF2FF" />
      <rect x="92" y="132" width="34" height="30" rx="8" fill="#EEF2FF" />
      <rect x="136" y="132" width="24" height="30" rx="8" fill="#EEF2FF" />

      {/* body accent stripe */}
      <rect x="30" y="200" width="220" height="14" fill="#EEF2FF" opacity="0.4" />

      {/* wheels */}
      <circle cx="80" cy="252" r="22" fill="#111827" />
      <circle cx="80" cy="252" r="9" fill="#E5E7EB" />
      <circle cx="200" cy="252" r="22" fill="#111827" />
      <circle cx="200" cy="252" r="9" fill="#E5E7EB" />

      {/* floating seat-map card */}
      <motion.g
        initial={reduceMotion ? false : { opacity: 0, y: 16, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, delay: 0.3, ease: "easeOut" }}
        transform="translate(260 40)"
      >
        <rect x="0" y="0" width="130" height="110" rx="18" fill="white" stroke="#E5E7EB" />
        {Array.from({ length: 6 }).map((_, i) => {
          const col = i % 3;
          const row = Math.floor(i / 3);
          const filled = i === 1 || i === 4;
          return (
            <motion.rect
              key={i}
              x={16 + col * 36}
              y={20 + row * 40}
              width="26"
              height="26"
              rx="7"
              fill={filled ? "#DDD6FE" : "#EEF2FF"}
              stroke={filled ? "#7C3AED" : "#C7D2FE"}
              initial={reduceMotion ? false : { opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3, delay: 0.5 + i * 0.06, ease: "easeOut" }}
            />
          );
        })}
      </motion.g>
    </svg>
  );
}
