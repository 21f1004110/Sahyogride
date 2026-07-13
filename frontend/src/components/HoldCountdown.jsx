import { useEffect, useState } from "react";

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

  useEffect(() => {
    setRemaining(secondsRemaining(expiresAt));
    const interval = setInterval(() => {
      setRemaining(secondsRemaining(expiresAt));
    }, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  if (remaining <= 0) {
    return (
      <p role="status" className="text-sm text-gray-600">
        Your hold has expired.
      </p>
    );
  }

  return (
    <p role="status" className="text-sm text-gray-700">
      Hold expires in{" "}
      <span className="font-heading font-semibold text-primary-700">{formatTime(remaining)}</span>
    </p>
  );
}
