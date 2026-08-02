import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { TruckIcon } from "@heroicons/react/24/solid";

// Demo-only simulation, not real GPS: the vehicle "moves" along a fixed
// window around departure_time, derived purely client-side. No map
// library, no coordinates, no backend/infra changes - see SAHYOG-33.
const EN_ROUTE_WINDOW_MINUTES = 30;
const TRIP_DURATION_MINUTES = 25;
const TICK_MS = 15000;

// Deterministic per trip so a demo looks the same on every reload,
// rather than jittering to a new number each render.
function seededStopCount(tripId) {
  return (tripId % 3) + 2;
}

function computeProgress(departureTime) {
  const departure = new Date(departureTime).getTime();
  const enRouteStart = departure - EN_ROUTE_WINDOW_MINUTES * 60 * 1000;
  const arrivedAt = departure + TRIP_DURATION_MINUTES * 60 * 1000;
  const now = Date.now();
  if (now <= enRouteStart) return 0;
  if (now >= arrivedAt) return 1;
  return (now - enRouteStart) / (arrivedAt - enRouteStart);
}

export default function VehicleTracker({ tripId, origin, destination, departureTime }) {
  const reduceMotion = useReducedMotion();
  const [progress, setProgress] = useState(() => computeProgress(departureTime));

  useEffect(() => {
    const tick = () => setProgress(computeProgress(departureTime));
    tick();
    const interval = setInterval(tick, TICK_MS);
    return () => clearInterval(interval);
  }, [departureTime]);

  const totalStops = seededStopCount(tripId);
  const stopsRemaining = Math.max(0, Math.round(totalStops * (1 - progress)));
  const arrived = progress >= 1;
  const enRoute = progress > 0 && progress < 1;

  const arrivedAt = new Date(departureTime).getTime() + TRIP_DURATION_MINUTES * 60 * 1000;
  const minutesLeft = Math.max(0, Math.round((arrivedAt - Date.now()) / 60000));

  const statusText = arrived
    ? "Arrived at destination"
    : enRoute
      ? `ETA ${minutesLeft} min · ${stopsRemaining} stop${stopsRemaining === 1 ? "" : "s"} away`
      : `Departs ${new Date(departureTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-heading font-semibold text-gray-900">Live vehicle tracker</h2>
        <span className="text-[10px] uppercase tracking-wide text-gray-400 font-semibold">
          Simulated for demo
        </span>
      </div>

      <div className="flex items-center justify-between text-xs font-medium text-gray-600 mb-3">
        <span className="truncate max-w-[45%]">{origin}</span>
        <span className="truncate max-w-[45%] text-right">{destination}</span>
      </div>

      <div className="relative h-6">
        <div
          className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-1.5 rounded-full bg-gray-100"
          aria-hidden="true"
        />
        <div
          className="absolute top-1/2 -translate-y-1/2 h-1.5 rounded-full bg-gradient-to-r from-primary-500 to-brand-500"
          style={{ width: `${progress * 100}%` }}
          aria-hidden="true"
        />
        <div
          className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-primary-600"
          aria-hidden="true"
        />
        <div
          className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-2.5 h-2.5 rounded-full bg-brand-600"
          aria-hidden="true"
        />
        <motion.div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 flex items-center justify-center w-6 h-6 rounded-full bg-white shadow-md ring-1 ring-primary-200"
          animate={{ left: `${progress * 100}%` }}
          transition={reduceMotion ? { duration: 0 } : { duration: 1.2, ease: "easeOut" }}
          aria-hidden="true"
        >
          <TruckIcon className="w-3.5 h-3.5 text-primary-700" />
        </motion.div>
      </div>

      <p role="status" aria-live="polite" className="mt-3 text-sm font-semibold text-primary-700 text-center">
        {statusText}
      </p>
    </div>
  );
}
