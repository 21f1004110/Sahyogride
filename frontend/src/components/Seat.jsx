import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowPathIcon, ClockIcon } from "@heroicons/react/24/outline";
import { SparklesIcon } from "@heroicons/react/24/solid";

import Magnetic from "./Magnetic";
import SeatIcon from "./SeatIcon";

// `solid` (filled vs outline seat silhouette) is the primary, non-colour
// signal for occupied vs empty - `badge` adds a second icon for "held"
// specifically, since outline-seat alone would look identical to
// available. CLAUDE.md: never colour alone - every state still reads
// correctly in greyscale.
export const STATUS_STYLES = {
  available: {
    solid: false,
    badge: null,
    label: "Available",
    classes: "bg-green-100 text-green-800 border-green-300",
  },
  held: {
    solid: false,
    badge: ClockIcon,
    label: "Held by someone",
    classes: "bg-amber-100 text-amber-800 border-amber-300",
  },
  reserved: {
    solid: true,
    badge: null,
    label: "Reserved",
    classes: "bg-gray-200 text-gray-600 border-gray-300",
  },
};

export const seatVariants = {
  hidden: { opacity: 0, scale: 0.85 },
  show: { opacity: 1, scale: 1, transition: { duration: 0.25, ease: "easeOut" } },
};

export default function Seat({
  seat,
  onClick,
  pending = false,
  suggested = false,
  suggestionReason,
  tabIndex = 0,
  seatRef,
  onFocus,
  onKeyDown,
}) {
  const reduceMotion = useReducedMotion();
  const { solid, badge: BadgeIcon, classes } = STATUS_STYLES[seat.status] || STATUS_STYLES.available;
  const clickable = seat.status === "available" && typeof onClick === "function" && !pending;
  const label = `Seat ${seat.seat_number}, ${pending ? "holding…" : seat.status}${
    seat.held_by_me ? " (held by you)" : ""
  }${suggested ? `. AI suggested: ${suggestionReason || "good match for your note"}` : ""}`;

  // Briefly pulses when another viewer's poll picks up a status change on
  // this seat (SAHYOG-35), so the "live" seat map is visibly live, not
  // just correct. Skipped under reduced motion.
  const prevStatusRef = useRef(seat.status);
  const [justChanged, setJustChanged] = useState(false);

  useEffect(() => {
    if (prevStatusRef.current === seat.status) return;
    prevStatusRef.current = seat.status;
    if (reduceMotion) return;
    setJustChanged(true);
    const timeout = setTimeout(() => setJustChanged(false), 900);
    return () => clearTimeout(timeout);
  }, [seat.status, reduceMotion]);

  // One-shot scale flourish the moment this seat becomes the rider's own
  // hold (SAHYOG-41) - modest feedback, since a hold is still provisional
  // (5 min TTL, can expire/be released). The bigger celebration lives on
  // Confirmation.jsx, for when the reservation is actually confirmed.
  const prevHeldByMeRef = useRef(seat.held_by_me);
  const [justHeld, setJustHeld] = useState(false);

  useEffect(() => {
    const wasHeld = prevHeldByMeRef.current;
    prevHeldByMeRef.current = seat.held_by_me;
    if (wasHeld || !seat.held_by_me || reduceMotion) return;
    setJustHeld(true);
    const timeout = setTimeout(() => setJustHeld(false), 500);
    return () => clearTimeout(timeout);
  }, [seat.held_by_me, reduceMotion]);

  const seatButton = (
    <motion.button
      ref={seatRef}
      type="button"
      variants={seatVariants}
      animate={justHeld ? { scale: [1, 1.25, 1] } : undefined}
      whileHover={!reduceMotion && clickable ? { scale: 1.08, y: -2 } : {}}
      whileTap={!reduceMotion && clickable ? { scale: 0.94 } : {}}
      transition={{ type: "spring", stiffness: 400, damping: 20 }}
      aria-label={label}
      aria-disabled={!clickable}
      title={label}
      tabIndex={tabIndex}
      onFocus={onFocus}
      onKeyDown={onKeyDown}
      onClick={clickable ? () => onClick(seat) : undefined}
      className={`relative min-w-[44px] min-h-[44px] flex flex-col items-center justify-center rounded-xl border text-sm font-medium shadow-sm ${classes} ${
        seat.held_by_me ? "ring-2 ring-primary-500 ring-offset-1" : ""
      } ${
        suggested && !seat.held_by_me ? "ring-2 ring-amber-400 ring-offset-1" : ""
      } ${justChanged ? "seat-pulse" : ""} ${
        clickable ? "cursor-pointer hover:shadow-md" : "cursor-default opacity-90"
      }`}
    >
      {suggested && !seat.held_by_me && (
        <span
          className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-amber-400 flex items-center justify-center shadow-sm"
          aria-hidden="true"
        >
          <SparklesIcon className="w-2.5 h-2.5 text-white" />
        </span>
      )}
      {BadgeIcon && (
        <span
          className="absolute -top-1.5 -left-1.5 w-4 h-4 rounded-full bg-amber-500 flex items-center justify-center shadow-sm"
          aria-hidden="true"
        >
          <BadgeIcon className="w-2.5 h-2.5 text-white" />
        </span>
      )}
      {pending ? (
        <ArrowPathIcon className="w-4 h-4 animate-spin" aria-hidden="true" />
      ) : (
        <SeatIcon solid={solid} className="w-4 h-4" />
      )}
      <span className="text-xs">{seat.seat_number}</span>
    </motion.button>
  );

  // Magnetic hover pull only on seats you can actually click (SAHYOG-41) -
  // held/reserved/pending seats shouldn't visually "float" toward the
  // cursor, that would read as a false affordance. Lower strength than
  // Landing.jsx's default since seats are small and packed tightly.
  return clickable ? (
    <Magnetic strength={0.15} className="inline-block">
      {seatButton}
    </Magnetic>
  ) : (
    seatButton
  );
}
