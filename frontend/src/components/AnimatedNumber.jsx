import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";

// Small count-up/down transition when a numeric value changes (SAHYOG-41) -
// used by TripDetail.jsx's SeatLegend, driven by the existing 5s poll
// (SAHYOG-35). Under reduced motion, just snaps to the new value.
export default function AnimatedNumber({ value }) {
  const reduceMotion = useReducedMotion();
  const prev = useRef(value);
  const [direction, setDirection] = useState(0);

  useEffect(() => {
    if (prev.current === value) return;
    setDirection(value > prev.current ? 1 : -1);
    prev.current = value;
  }, [value]);

  return (
    <motion.span
      key={value}
      initial={reduceMotion ? false : { y: direction * -8, opacity: 0.3 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="inline-block tabular-nums"
    >
      {value}
    </motion.span>
  );
}
