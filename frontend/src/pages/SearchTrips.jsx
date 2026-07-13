import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { searchTrips } from "../api/trips";
import Empty from "../components/states/Empty";
import ErrorState from "../components/states/ErrorState";
import Loading from "../components/states/Loading";

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

  return (
    <div className="min-h-screen px-4 py-6 max-w-md mx-auto">
      <h1 className="text-2xl font-semibold mb-4">Search trips</h1>

      <form onSubmit={handleSubmit} className="space-y-3 mb-6">
        <div>
          <label htmlFor="origin" className="block text-sm font-medium">
            Origin
          </label>
          <input
            id="origin"
            type="text"
            value={filters.origin}
            onChange={(e) => setFilters((f) => ({ ...f, origin: e.target.value }))}
            className="mt-1 block w-full min-h-[44px] rounded border border-gray-300 px-3"
          />
        </div>

        <div>
          <label htmlFor="destination" className="block text-sm font-medium">
            Destination
          </label>
          <input
            id="destination"
            type="text"
            value={filters.destination}
            onChange={(e) => setFilters((f) => ({ ...f, destination: e.target.value }))}
            className="mt-1 block w-full min-h-[44px] rounded border border-gray-300 px-3"
          />
        </div>

        <div>
          <label htmlFor="date" className="block text-sm font-medium">
            Date
          </label>
          <input
            id="date"
            type="date"
            value={filters.date}
            onChange={(e) => setFilters((f) => ({ ...f, date: e.target.value }))}
            className="mt-1 block w-full min-h-[44px] rounded border border-gray-300 px-3"
          />
        </div>

        <div>
          <label htmlFor="q" className="block text-sm font-medium">
            Search
          </label>
          <input
            id="q"
            type="text"
            placeholder="e.g. hospital, exam, work"
            value={filters.q}
            onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
            className="mt-1 block w-full min-h-[44px] rounded border border-gray-300 px-3"
          />
        </div>

        <button
          type="submit"
          className="w-full min-h-[44px] rounded bg-blue-600 text-white font-medium"
        >
          Search
        </button>
      </form>

      {isLoading && <Loading />}
      {isError && <ErrorState message="Couldn't load trips." onRetry={refetch} />}
      {!isLoading && !isError && data.trips.length === 0 && (
        <Empty message="No trips match your search." />
      )}
      {!isLoading && !isError && data.trips.length > 0 && (
        <ul className="space-y-3">
          {data.trips.map((trip) => (
            <li key={trip.id} className="rounded border border-gray-300 p-3">
              <p className="font-medium">
                {trip.origin} &rarr; {trip.destination}
              </p>
              <p className="text-sm text-gray-600">
                {new Date(trip.departure_time).toLocaleString()}
              </p>
              <p className="text-sm">
                {trip.seats_available} of {trip.total_seats} seats available
              </p>
              {trip.purpose && <p className="text-sm text-gray-600">{trip.purpose}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
