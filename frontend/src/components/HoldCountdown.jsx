import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { ClockIcon } from "@heroicons/react/24/outline";

function secondsRemaining(expiresAt) {
  return Math.max(0, Math.round((new Date(expiresAt).getTime() - Date.now()) / 1000));
}

function formatTime(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export default function HoldCountdown({ expiresAt }) {
  const [remaining, setRemaining] = useState(() => secondsRemaining(expiresAt));
  const totalRef = useRef(Math.max(1, secondsRemaining(expiresAt)));

  useEffect(() => {
    totalRef.current = Math.max(1, secondsRemaining(expiresAt));
    setRemaining(secondsRemaining(expiresAt));
    const interval = setInterval(() => {
      setRemaining(secondsRemaining(expiresAt));
    }, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  if (remaining <= 0) {
    return (
      <p role="status" className="flex items-center gap-2 text-sm text-gray-600">
        <ClockIcon className="w-4 h-4 text-gray-400" aria-hidden="true" />
        Your hold has expired.
      </p>
    );
  }

  const pct = Math.min(100, Math.round((remaining / totalRef.current) * 100));
  const urgent = remaining <= 60;
  const warning = remaining <= 120 && !urgent;

  const barColor = urgent
    ? "bg-red-500"
    : warning
      ? "bg-amber-500"
      : "bg-gradient-to-r from-primary-500 to-brand-500";
  const textColor = urgent ? "text-red-700" : warning ? "text-amber-700" : "text-primary-700";

  return (
    <div role="status" className="space-y-2">
      <p className="flex items-center gap-2 text-sm text-gray-700">
        <ClockIcon className={`w-4 h-4 shrink-0 ${textColor}`} aria-hidden="true" />
        Hold expires in{" "}
        <motion.span
          key={urgent ? "urgent" : "normal"}
          animate={urgent ? { scale: [1, 1.06, 1] } : {}}
          transition={urgent ? { duration: 1, repeat: Infinity, ease: "easeInOut" } : {}}
          className={`font-heading font-semibold tabular-nums ${textColor}`}
        >
          {formatTime(remaining)}
        </motion.span>
      </p>
      <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
        <motion.div
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.4, ease: "linear" }}
          className={`h-full rounded-full ${barColor}`}
        />
      </div>
    </div>
  );
}
