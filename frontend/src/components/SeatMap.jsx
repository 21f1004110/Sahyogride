import { useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { UserIcon } from "@heroicons/react/24/solid";

import Seat from "./Seat";

// 2 seats | aisle | 2 seats, like a shuttle interior (SAHYOG-36). Pure
// layout - seat data/order/statuses are untouched, just how they're
// arranged on screen.
const SEATS_PER_ROW = 4;

function chunkIntoRows(seats, perRow) {
  const rows = [];
  for (let i = 0; i < seats.length; i += perRow) {
    rows.push(seats.slice(i, i + perRow));
  }
  return rows;
}

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.02 } },
};

export default function SeatMap({ seats, onSeatClick, pendingSeatId, suggestedSeatId, suggestionReason }) {
  const reduceMotion = useReducedMotion();
  const rows = useMemo(() => chunkIntoRows(seats, SEATS_PER_ROW), [seats]);
  const seatRefs = useRef({});
  const [activeSeatId, setActiveSeatId] = useState(null);
  const effectiveActiveId = activeSeatId ?? seats[0]?.id ?? null;

  function focusSeat(id) {
    seatRefs.current[id]?.focus();
  }

  // Roving tabIndex + arrow-key navigation (SAHYOG-37): the whole map is
  // one tab stop, arrow keys move between seats along the same rows/
  // columns the bus layout above renders - including unavailable seats,
  // since those are no longer keyboard-unreachable (see Seat.jsx).
  function handleKeyDown(e, rowIndex, colIndex) {
    let target = null;
    if (e.key === "ArrowRight") target = rows[rowIndex]?.[colIndex + 1];
    else if (e.key === "ArrowLeft") target = rows[rowIndex]?.[colIndex - 1];
    else if (e.key === "ArrowDown") target = rows[rowIndex + 1]?.[colIndex];
    else if (e.key === "ArrowUp") target = rows[rowIndex - 1]?.[colIndex];
    if (target) {
      e.preventDefault();
      setActiveSeatId(target.id);
      focusSeat(target.id);
    }
  }

  return (
    <div className="bg-gradient-to-b from-gray-50 to-white rounded-2xl border border-gray-200 p-4 sm:p-6">
      <div
        className="flex items-center justify-center gap-2 pb-4 mb-4 border-b border-dashed border-gray-200 text-gray-400"
        aria-hidden="true"
      >
        <UserIcon className="w-5 h-5" />
        <span className="text-xs font-semibold uppercase tracking-wide">Front &middot; Driver</span>
      </div>

      <p className="sr-only">Use arrow keys to browse seats, Enter or Space to select.</p>

      <motion.div
        role="grid"
        aria-label="Seat map"
        variants={container}
        initial={reduceMotion ? false : "hidden"}
        animate="show"
        className="space-y-2.5"
      >
        {rows.map((row, rowIndex) => {
          const aisleIndex = row.length > 1 ? Math.ceil(row.length / 2) : -1;
          return (
            <div role="row" key={rowIndex} className="flex items-center justify-center gap-2">
              {row.map((seat, colIndex) => (
                <div key={seat.id} role="gridcell" className="flex items-center gap-2">
                  {colIndex === aisleIndex && (
                    <span className="w-5 sm:w-8 inline-block" aria-hidden="true" />
                  )}
                  <Seat
                    seat={seat}
                    onClick={onSeatClick}
                    pending={seat.id === pendingSeatId}
                    suggested={seat.id === suggestedSeatId}
                    suggestionReason={suggestionReason}
                    tabIndex={seat.id === effectiveActiveId ? 0 : -1}
                    seatRef={(el) => (seatRefs.current[seat.id] = el)}
                    onFocus={() => setActiveSeatId(seat.id)}
                    onKeyDown={(e) => handleKeyDown(e, rowIndex, colIndex)}
                  />
                </div>
              ))}
            </div>
          );
        })}
      </motion.div>
    </div>
  );
}
