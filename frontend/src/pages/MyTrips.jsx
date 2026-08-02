import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion, useReducedMotion } from "framer-motion";
import {
  ClockIcon,
  FireIcon,
  SparklesIcon,
  TagIcon,
  UserGroupIcon,
  UsersIcon,
} from "@heroicons/react/24/outline";

import { getMyTrips } from "../api/trips";
import Empty from "../components/states/Empty";
import ErrorState from "../components/states/ErrorState";
import { TripListSkeleton } from "../components/states/Loading";

export default function MyTrips() {
  const reduceMotion = useReducedMotion();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["my-trips"],
    queryFn: getMyTrips,
  });

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <div className="flex items-center gap-3 mb-8">
        <span className="icon-badge bg-gradient-to-br from-brand-500 to-brand-700">
          <UserGroupIcon className="w-6 h-6 relative" aria-hidden="true" />
        </span>
        <div>
          <h1 className="font-heading text-3xl font-bold text-gray-900">My trips</h1>
          <p className="text-sm text-gray-600">Trips you've published as a coordinator.</p>
        </div>
      </div>

      {isLoading && <TripListSkeleton />}
      {isError && <ErrorState message="Couldn't load your trips." onRetry={refetch} />}

      {!isLoading && !isError && data.trips.length === 0 && (
        <div className="text-center">
          <Empty message="You haven't published a trip yet." />
          <Link to="/trips/new" className="btn-primary mt-2 inline-flex">
            Create a trip
          </Link>
        </div>
      )}

      {!isLoading && !isError && data.trips.length > 0 && (
        <ul className="grid gap-4 sm:grid-cols-2">
          {data.trips.map((trip, i) => (
            <motion.li
              key={trip.id}
              initial={reduceMotion ? false : { opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: reduceMotion ? 0 : i * 0.05, ease: "easeOut" }}
            >
              <div className="card p-5 h-full flex flex-col">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <p className="font-heading font-semibold text-gray-900 text-lg">
                    {trip.origin} &rarr; {trip.destination}
                  </p>
                  {trip.ai_high_demand && (
                    <span className="badge-red shrink-0">
                      <FireIcon className="w-3.5 h-3.5" aria-hidden="true" />
                      High demand
                    </span>
                  )}
                </div>

                {trip.ai_summary && (
                  <p className="flex items-start gap-1.5 text-sm text-primary-700 mb-3">
                    <SparklesIcon className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                    <span>{trip.ai_summary}</span>
                  </p>
                )}

                <div className="space-y-2 text-sm text-gray-600 flex-1 mt-3">
                  <p className="flex items-center gap-2">
                    <ClockIcon className="w-4 h-4 text-gray-400" aria-hidden="true" />
                    {new Date(trip.departure_time).toLocaleString()}
                  </p>
                  {trip.purpose && (
                    <p className="flex items-center gap-2">
                      <TagIcon className="w-4 h-4 text-gray-400" aria-hidden="true" />
                      {trip.purpose}
                    </p>
                  )}
                  <p className="flex items-center gap-2">
                    <UsersIcon className="w-4 h-4 text-gray-400" aria-hidden="true" />
                    {trip.seats_available} of {trip.total_seats} seats available
                  </p>
                </div>

                <Link to={`/trips/${trip.id}/passengers`} className="btn-secondary mt-4 justify-center">
                  View passengers
                </Link>
              </div>
            </motion.li>
          ))}
        </ul>
      )}
    </div>
  );
}
