import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";

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
    <div className="max-w-md mx-auto px-4 py-10">
      <h1 className="font-heading text-2xl font-bold text-gray-900 mb-4">Search trips</h1>

      <form onSubmit={handleSubmit} className="card p-4 space-y-3 mb-6">
        <div>
          <label htmlFor="origin" className="field-label">
            Origin
          </label>
          <input
            id="origin"
            type="text"
            value={filters.origin}
            onChange={(e) => setFilters((f) => ({ ...f, origin: e.target.value }))}
            className="input-field"
          />
        </div>

        <div>
          <label htmlFor="destination" className="field-label">
            Destination
          </label>
          <input
            id="destination"
            type="text"
            value={filters.destination}
            onChange={(e) => setFilters((f) => ({ ...f, destination: e.target.value }))}
            className="input-field"
          />
        </div>

        <div>
          <label htmlFor="date" className="field-label">
            Date
          </label>
          <input
            id="date"
            type="date"
            value={filters.date}
            onChange={(e) => setFilters((f) => ({ ...f, date: e.target.value }))}
            className="input-field"
          />
        </div>

        <div>
          <label htmlFor="q" className="field-label">
            Search
          </label>
          <input
            id="q"
            type="text"
            placeholder="e.g. hospital, exam, work"
            value={filters.q}
            onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
            className="input-field"
          />
        </div>

        <button type="submit" className="btn-primary w-full">
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
            <li key={trip.id}>
              <Link to={`/trips/${trip.id}`} className="card block p-4 hover:shadow-md transition">
                <p className="font-heading font-semibold text-gray-900">
                  {trip.origin} &rarr; {trip.destination}
                </p>
                <p className="text-sm text-gray-600">
                  {new Date(trip.departure_time).toLocaleString()}
                </p>
                <p className="text-sm text-primary-700 font-medium">
                  {trip.seats_available} of {trip.total_seats} seats available
                </p>
                {trip.purpose && <p className="text-sm text-gray-600">{trip.purpose}</p>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
