import { useEffect } from "react";

const TARGET_SELECTOR = ".btn-primary, .btn-secondary, .ripple-target";

export default function RippleFX() {
  useEffect(() => {
    function handlePointerDown(e) {
      if (e.button !== undefined && e.button !== 0) return;
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

      const target = e.target.closest(TARGET_SELECTOR);
      if (!target) return;

      const rect = target.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height) * 1.8;
      const x = e.clientX - rect.left - size / 2;
      const y = e.clientY - rect.top - size / 2;

      const ripple = document.createElement("span");
      ripple.className = `ripple ${target.classList.contains("btn-primary") ? "" : "ripple--dark"}`;
      ripple.style.width = `${size}px`;
      ripple.style.height = `${size}px`;
      ripple.style.left = `${x}px`;
      ripple.style.top = `${y}px`;

      target.appendChild(ripple);
      const cleanup = () => ripple.remove();
      ripple.addEventListener("animationend", cleanup);
      setTimeout(cleanup, 700);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  return null;
}
