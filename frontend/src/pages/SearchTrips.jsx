import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  CalendarDaysIcon,
  ClockIcon,
  MagnifyingGlassIcon,
  MapPinIcon,
  TagIcon,
  UsersIcon,
} from "@heroicons/react/24/outline";

import { searchTrips } from "../api/trips";
import Empty from "../components/states/Empty";
import ErrorState from "../components/states/ErrorState";
import Loading from "../components/states/Loading";

function SeatAvailabilityBar({ available, total }) {
  const pct = total > 0 ? Math.round((available / total) * 100) : 0;
  const low = available === 0;

  return (
    <div>
      <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
        <span className={`font-medium ${low ? "text-gray-500" : "text-primary-700"}`}>
          {available} of {total} seats available
        </span>
        <span>{pct}%</span>
      </div>
      <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
        <div
          className={`h-full rounded-full ${low ? "bg-gray-300" : "bg-gradient-to-r from-primary-500 to-brand-500"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export default function SearchTrips() {
  const [filters, setFilters] = useState({ origin: "", destination: "", date: "", q: "" });
  const [appliedFilters, setAppliedFilters] = useState(filters);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["trips", appliedFilters],
    queryFn: () => searchTrips(appliedFilters),
  });

  function handleSubmit(e) {
    e.preventDefault();
    setAppliedFilters(filters);
  }

  function clearFilters() {
    const cleared = { origin: "", destination: "", date: "", q: "" };
    setFilters(cleared);
    setAppliedFilters(cleared);
  }

  const hasFilters = Object.values(appliedFilters).some(Boolean);

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <div className="flex items-center gap-3 mb-8">
        <span className="w-11 h-11 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center">
          <MagnifyingGlassIcon className="w-6 h-6" aria-hidden="true" />
        </span>
        <div>
          <h1 className="font-heading text-3xl font-bold text-gray-900">Search trips</h1>
          <p className="text-sm text-gray-600">Find a free shuttle trip with an open seat.</p>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-[320px_1fr]">
        <form onSubmit={handleSubmit} className="card p-5 space-y-4 lg:sticky lg:top-24 h-fit">
          <h2 className="font-heading font-semibold text-gray-900">Filters</h2>

          <div>
            <label htmlFor="origin" className="field-label">
              Origin
            </label>
            <div className="input-icon-wrap">
              <MapPinIcon className="input-icon" aria-hidden="true" />
              <input
                id="origin"
                type="text"
                value={filters.origin}
                onChange={(e) => setFilters((f) => ({ ...f, origin: e.target.value }))}
                className="input-field !mt-0 pl-10"
              />
            </div>
          </div>

          <div>
            <label htmlFor="destination" className="field-label">
              Destination
            </label>
            <div className="input-icon-wrap">
              <MapPinIcon className="input-icon" aria-hidden="true" />
              <input
                id="destination"
                type="text"
                value={filters.destination}
                onChange={(e) => setFilters((f) => ({ ...f, destination: e.target.value }))}
                className="input-field !mt-0 pl-10"
              />
            </div>
          </div>

          <div>
            <label htmlFor="date" className="field-label">
              Date
            </label>
            <div className="input-icon-wrap">
              <CalendarDaysIcon className="input-icon" aria-hidden="true" />
              <input
                id="date"
                type="date"
                value={filters.date}
                onChange={(e) => setFilters((f) => ({ ...f, date: e.target.value }))}
                className="input-field !mt-0 pl-10"
              />
            </div>
          </div>

          <div>
            <label htmlFor="q" className="field-label">
              Search
            </label>
            <div className="input-icon-wrap">
              <MagnifyingGlassIcon className="input-icon" aria-hidden="true" />
              <input
                id="q"
                type="text"
                placeholder="e.g. hospital, exam, work"
                value={filters.q}
                onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
                className="input-field !mt-0 pl-10"
              />
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <button type="submit" className="btn-primary flex-1">
              Search
            </button>
            {hasFilters && (
              <button type="button" onClick={clearFilters} className="btn-secondary">
                Clear
              </button>
            )}
          </div>
        </form>

        <div>
          {isLoading && <Loading />}
          {isError && <ErrorState message="Couldn't load trips." onRetry={refetch} />}
          {!isLoading && !isError && data.trips.length === 0 && (
            <Empty message="No trips match your search." />
          )}
          {!isLoading && !isError && data.trips.length > 0 && (
            <>
              <p className="text-sm text-gray-500 mb-4">
                {data.trips.length} trip{data.trips.length === 1 ? "" : "s"} found
              </p>
              <ul className="grid gap-4 sm:grid-cols-2">
                {data.trips.map((trip) => (
                  <li key={trip.id}>
                    <Link
                      to={`/trips/${trip.id}`}
                      className="card block p-5 h-full hover:shadow-md hover:-translate-y-0.5 transition"
                    >
                      <p className="font-heading font-semibold text-gray-900 text-lg mb-3">
                        {trip.origin} &rarr; {trip.destination}
                      </p>

                      <div className="space-y-2 text-sm text-gray-600">
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
                          {trip.total_seats} total seats
                        </p>
                      </div>

                      <div className="mt-4">
                        <SeatAvailabilityBar available={trip.seats_available} total={trip.total_seats} />
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
