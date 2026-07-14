import { motion, useReducedMotion } from "framer-motion";

import Seat from "./Seat";

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.015 } },
};

export default function SeatMap({ seats, onSeatClick }) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      role="list"
      aria-label="Seat map"
      variants={container}
      initial={reduceMotion ? false : "hidden"}
      animate="show"
      className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 gap-3"
    >
      {seats.map((seat) => (
        <div role="listitem" key={seat.id}>
          <Seat seat={seat} onClick={onSeatClick} />
        </div>
      ))}
    </motion.div>
  );
}
