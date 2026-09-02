import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { ClockIcon, SparklesIcon } from "@heroicons/react/24/outline";

export default function SimilarTrips({ trips, fallback }) {
  const reduceMotion = useReducedMotion();

  return (
    <div className="card p-5">
      <h2 className="font-heading font-semibold text-gray-900 flex items-center gap-2 mb-1">
        <SparklesIcon className="w-5 h-5 text-primary-600" aria-hidden="true" />
        Similar trips
      </h2>
      <ul className="space-y-2 mt-3">
        {trips.map((trip, i) => (
          <motion.li
            key={trip.id}
            initial={reduceMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: reduceMotion ? 0 : i * 0.05, ease: "easeOut" }}
          >
            <Link
              to={`/trips/${trip.id}`}
              className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 px-4 py-3 hover:border-primary-300 hover:bg-primary-50/40 transition"
            >
              <div className="min-w-0">
                <p className="font-medium text-gray-900 truncate">
                  {trip.origin} &rarr; {trip.destination}
                </p>
                <p className="text-sm text-gray-500 flex items-center gap-1.5 mt-0.5">
                  <ClockIcon className="w-4 h-4 text-gray-400" aria-hidden="true" />
                  {new Date(trip.departure_time).toLocaleString()}
                </p>
              </div>
              <span className="badge-green shrink-0">{trip.seats_available} open</span>
            </Link>
          </motion.li>
        ))}
      </ul>
      <p className="text-xs text-gray-400 mt-3">{fallback ? "Same destination" : "Similar by AI"}</p>
    </div>
  );
}
