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
    return <p role="status">Your hold has expired.</p>;
  }

  return (
    <p role="status">
      Hold expires in <span className="font-medium">{formatTime(remaining)}</span>
    </p>
  );
}
