import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { motion, useReducedMotion } from "framer-motion";
import { ClockIcon, SparklesIcon } from "@heroicons/react/24/outline";

import { aiSearch } from "../api/ai";
import Empty from "./states/Empty";
import ErrorState from "./states/ErrorState";

export default function AssistantBox() {
  const reduceMotion = useReducedMotion();
  const [query, setQuery] = useState("");

  const searchMutation = useMutation({
    mutationFn: (q) => aiSearch(q),
  });

  function handleSubmit(e) {
    e.preventDefault();
    const trimmed = query.trim();
    if (!trimmed) return;
    searchMutation.mutate(trimmed);
  }

  return (
    <div className="card p-5">
      <h2 className="font-heading font-semibold text-gray-900 flex items-center gap-2 mb-1">
        <SparklesIcon className="w-5 h-5 text-primary-600" aria-hidden="true" />
        Describe what you need
      </h2>
      <p className="text-sm text-gray-500 mb-3">
        e.g. &ldquo;a ride to the hospital tomorrow morning&rdquo; — this only searches, it can never
        book, cancel, or change anything for you.
      </p>

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="I need a ride to..."
          aria-label="Describe the trip you need"
          className="input-field !mt-0 flex-1"
        />
        <button type="submit" disabled={searchMutation.isPending} className="btn-primary shrink-0">
          {searchMutation.isPending ? "Searching…" : "Ask"}
        </button>
      </form>

      {searchMutation.isError && (
        <div className="mt-4">
          <ErrorState
            message="Couldn't run that search. Please try again."
            onRetry={() => searchMutation.mutate(query.trim())}
          />
        </div>
      )}

      {searchMutation.isSuccess && (
        <div className="mt-4">
          {searchMutation.data.trips.length === 0 ? (
            <Empty message="No trips matched that. Try the filters below, or describe it differently." />
          ) : (
            <>
              <ul className="space-y-2">
                {searchMutation.data.trips.map((trip, i) => (
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
                      <div>
                        <p className="font-medium text-gray-900">
                          {trip.origin} &rarr; {trip.destination}
                        </p>
                        <p className="text-sm text-gray-500 flex items-center gap-1.5 mt-0.5">
                          <ClockIcon className="w-4 h-4 text-gray-400" aria-hidden="true" />
                          {new Date(trip.departure_time).toLocaleString()}
                        </p>
                      </div>
                    </Link>
                  </motion.li>
                ))}
              </ul>
              <p className="text-xs text-gray-400 mt-3">
                {searchMutation.data.fallback ? "Matched by keyword" : "Matched by AI"}
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
