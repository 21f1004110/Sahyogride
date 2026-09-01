import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { motion, useReducedMotion } from "framer-motion";
import {
  CalendarDaysIcon,
  ClockIcon,
  MapPinIcon,
  SparklesIcon,
  TagIcon,
  UsersIcon,
} from "@heroicons/react/24/outline";

import { aiSearch } from "../api/ai";
import Empty from "./states/Empty";
import ErrorState from "./states/ErrorState";

// Pre-written prompts that exercise query understanding (date + time-of-
// day + purpose) end to end, so a demo never depends on someone typing a
// good example live.
const EXAMPLE_PROMPTS = [
  "a ride to the hospital tomorrow morning",
  "I want to catch my flight",
  "exam shuttle this week",
];

function ParsedChip({ icon: Icon, label }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-primary-700 bg-primary-50 border border-primary-100 rounded-full px-2.5 py-1 capitalize">
      <Icon className="w-3.5 h-3.5" aria-hidden="true" />
      {label}
    </span>
  );
}

function MatchScoreBar({ score }) {
  const pct = Math.round((score ?? 0) * 100);
  return (
    <div className="flex items-center gap-2 shrink-0">
      <div className="h-1.5 w-14 rounded-full bg-gray-100 overflow-hidden shrink-0" aria-hidden="true">
        <div
          className="h-full rounded-full bg-gradient-to-r from-primary-500 to-brand-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[11px] text-gray-400 font-medium tabular-nums">{pct}% match</span>
    </div>
  );
}

export default function AssistantBox({ initialQuery = "" }) {
  const reduceMotion = useReducedMotion();
  const [query, setQuery] = useState(initialQuery);

  const searchMutation = useMutation({
    mutationFn: (q) => aiSearch(q),
  });

  function runSearch(text) {
    const trimmed = text.trim();
    if (!trimmed) return;
    setQuery(text);
    searchMutation.mutate(trimmed);
  }

  // Lets a link elsewhere in the app (e.g. the help assistant's "no trip
  // matched, try searching" suggestion) land here with the search already
  // run, instead of dropping the rider on a blank box.
  useEffect(() => {
    if (initialQuery.trim()) runSearch(initialQuery);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuery]);

  function handleSubmit(e) {
    e.preventDefault();
    runSearch(query);
  }

  const parsed = searchMutation.data?.parsed;
  const hasParsedSignal = Boolean(
    parsed && (parsed.date_label || parsed.time_of_day || parsed.purpose || parsed.location_hint),
  );

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between gap-2 mb-1">
        <h2 className="font-heading font-semibold text-gray-900 flex items-center gap-2">
          <SparklesIcon className="w-5 h-5 text-primary-600" aria-hidden="true" />
          Describe what you need
        </h2>
        <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-primary-700 bg-primary-50 border border-primary-100 rounded-full px-2.5 py-1 shrink-0">
          <SparklesIcon className="w-3 h-3" aria-hidden="true" />
          AI-powered
        </span>
      </div>
      <p className="text-sm text-gray-500 mb-3">
        Type it like you&apos;d say it out loud — this only searches, it can never book, cancel,
        or change anything for you.
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
          {searchMutation.isPending ? "Thinking…" : "Ask"}
        </button>
      </form>

      {!searchMutation.isSuccess && (
        <div className="flex flex-wrap gap-2 mt-3">
          {EXAMPLE_PROMPTS.map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() => runSearch(prompt)}
              className="text-xs text-primary-700 bg-primary-50/70 hover:bg-primary-100 border border-primary-100 rounded-full px-3 py-1.5 transition"
            >
              Try: &ldquo;{prompt}&rdquo;
            </button>
          ))}
        </div>
      )}

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
          {hasParsedSignal && (
            <div className="flex flex-wrap items-center gap-1.5 mb-3">
              <span className="text-xs text-gray-400">Understood:</span>
              {parsed.date_label && <ParsedChip icon={CalendarDaysIcon} label={parsed.date_label} />}
              {parsed.time_of_day && <ParsedChip icon={ClockIcon} label={parsed.time_of_day} />}
              {parsed.purpose && <ParsedChip icon={TagIcon} label={parsed.purpose} />}
              {parsed.location_hint && <ParsedChip icon={MapPinIcon} label={parsed.location_hint} />}
            </div>
          )}

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
                      className="block rounded-xl border border-gray-200 px-4 py-3 hover:border-primary-300 hover:bg-primary-50/40 transition"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900 truncate">
                            {trip.origin} &rarr; {trip.destination}
                          </p>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500 mt-1">
                            <span className="flex items-center gap-1">
                              <ClockIcon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                              {new Date(trip.departure_time).toLocaleString()}
                            </span>
                            {trip.purpose && (
                              <span className="flex items-center gap-1">
                                <TagIcon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                                {trip.purpose}
                              </span>
                            )}
                            {trip.seats_available != null && (
                              <span className="flex items-center gap-1">
                                <UsersIcon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                                {trip.seats_available}/{trip.total_seats} seats
                              </span>
                            )}
                          </div>
                        </div>
                        {trip.match_score != null && <MatchScoreBar score={trip.match_score} />}
                      </div>
                      {trip.match_reason && (
                        <p className="text-xs text-primary-600 mt-1.5">{trip.match_reason}</p>
                      )}
                    </Link>
                  </motion.li>
                ))}
              </ul>
              <p className="flex items-center gap-1 text-xs text-gray-400 mt-3">
                <SparklesIcon className="w-3.5 h-3.5" aria-hidden="true" />
                {searchMutation.data.fallback
                  ? "Matched using AI-style query understanding (keywords, dates, purpose)"
                  : "Matched by AI semantic search"}
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
