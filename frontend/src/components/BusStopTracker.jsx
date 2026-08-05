import { useQuery } from "@tanstack/react-query";
import { motion, useReducedMotion } from "framer-motion";
import { CheckCircleIcon, MapPinIcon, TruckIcon } from "@heroicons/react/24/outline";

import { getTrip } from "../api/trips";
import Empty from "./states/Empty";

// Live, coordinator-driven position (SAHYOG-46) - polls the same
// GET /trips/{id} the seat map already polls (SAHYOG-35), no separate
// endpoint needed. Not GPS/maps: current_stop_sequence is a plain index
// the coordinator sets by hand from ManageStops.jsx.
const POLL_MS = 5000;

export default function BusStopTracker({ tripId }) {
  const reduceMotion = useReducedMotion();

  const { data: trip } = useQuery({
    queryKey: ["trip", String(tripId)],
    queryFn: () => getTrip(tripId),
    refetchInterval: POLL_MS,
    refetchIntervalInBackground: false,
  });

  if (!trip) return null;

  if (trip.bus_stops.length === 0) {
    return (
      <div className="card p-5">
        <h2 className="font-heading font-semibold text-gray-900 mb-2">Live vehicle tracker</h2>
        <Empty message="The coordinator hasn't set up live tracking for this trip yet." />
      </div>
    );
  }

  const currentSequence = trip.current_stop_sequence;
  const currentStop = trip.bus_stops.find((s) => s.sequence === currentSequence);

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-1">
        <h2 className="font-heading font-semibold text-gray-900">Live vehicle tracker</h2>
        <span className="text-[10px] uppercase tracking-wide text-gray-400 font-semibold">Live</span>
      </div>
      <p role="status" aria-live="polite" className="text-sm text-primary-700 font-medium mb-4">
        {currentStop ? `Currently at: ${currentStop.name}` : "Not yet departed"}
      </p>

      <ol className="space-y-2">
        {trip.bus_stops.map((stop, i) => {
          const isCurrent = currentSequence === stop.sequence;
          const isPast = currentSequence !== null && stop.sequence < currentSequence;
          return (
            <motion.li
              key={stop.id}
              layout={!reduceMotion}
              className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm ${
                isCurrent ? "bg-primary-50 ring-1 ring-primary-200" : ""
              }`}
            >
              {isCurrent ? (
                <TruckIcon className="w-4 h-4 text-primary-600 shrink-0" aria-hidden="true" />
              ) : isPast ? (
                <CheckCircleIcon className="w-4 h-4 text-gray-300 shrink-0" aria-hidden="true" />
              ) : (
                <MapPinIcon className="w-4 h-4 text-gray-300 shrink-0" aria-hidden="true" />
              )}
              <span className={isCurrent ? "font-semibold text-primary-900" : isPast ? "text-gray-400" : "text-gray-600"}>
                {stop.name}
              </span>
            </motion.li>
          );
        })}
      </ol>
    </div>
  );
}
