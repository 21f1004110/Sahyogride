import { useRef } from "react";
import { useReducedMotion } from "framer-motion";

export default function Magnetic({ children, strength = 0.3, className = "" }) {
  const ref = useRef(null);
  const reduceMotion = useReducedMotion();

  function handleMouseMove(e) {
    if (reduceMotion || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const x = (e.clientX - rect.left - rect.width / 2) * strength;
    const y = (e.clientY - rect.top - rect.height / 2) * strength;
    ref.current.style.setProperty("--mx", `${x}px`);
    ref.current.style.setProperty("--my", `${y}px`);
  }

  function reset() {
    ref.current?.style.setProperty("--mx", "0px");
    ref.current?.style.setProperty("--my", "0px");
  }

  return (
    <span
      ref={ref}
      onMouseMove={handleMouseMove}
      onMouseLeave={reset}
      className={`magnetic inline-block ${className}`}
    >
      {children}
    </span>
  );
}
