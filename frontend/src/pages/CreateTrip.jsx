import { useState } from "react";

import { createTrip } from "../api/trips";
import ErrorState from "../components/states/ErrorState";
import Loading from "../components/states/Loading";

export default function CreateTrip() {
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [departureTime, setDepartureTime] = useState("");
  const [totalSeats, setTotalSeats] = useState(4);
  const [purpose, setPurpose] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [created, setCreated] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const trip = await createTrip({
        origin,
        destination,
        departure_time: new Date(departureTime).toISOString(),
        total_seats: Number(totalSeats),
        purpose,
      });
      setCreated(trip);
      setOrigin("");
      setDestination("");
      setDepartureTime("");
      setTotalSeats(4);
      setPurpose("");
    } catch (err) {
      setError(err.response?.data?.error?.message || "Couldn't create the trip. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
        <h1 className="text-2xl font-semibold">Create a trip</h1>

        {created && (
          <p role="status" className="text-green-700">
            Trip #{created.id} created with {created.total_seats} seats.
          </p>
        )}
        {error && <ErrorState message={error} />}

        <div>
          <label htmlFor="origin" className="block text-sm font-medium">
            Origin
          </label>
          <input
            id="origin"
            type="text"
            required
            value={origin}
            onChange={(e) => setOrigin(e.target.value)}
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
            required
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            className="mt-1 block w-full min-h-[44px] rounded border border-gray-300 px-3"
          />
        </div>

        <div>
          <label htmlFor="departure_time" className="block text-sm font-medium">
            Departure time
          </label>
          <input
            id="departure_time"
            type="datetime-local"
            required
            value={departureTime}
            onChange={(e) => setDepartureTime(e.target.value)}
            className="mt-1 block w-full min-h-[44px] rounded border border-gray-300 px-3"
          />
        </div>

        <div>
          <label htmlFor="total_seats" className="block text-sm font-medium">
            Total seats
          </label>
          <input
            id="total_seats"
            type="number"
            min={1}
            max={100}
            required
            value={totalSeats}
            onChange={(e) => setTotalSeats(e.target.value)}
            className="mt-1 block w-full min-h-[44px] rounded border border-gray-300 px-3"
          />
        </div>

        <div>
          <label htmlFor="purpose" className="block text-sm font-medium">
            Purpose (optional)
          </label>
          <input
            id="purpose"
            type="text"
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            className="mt-1 block w-full min-h-[44px] rounded border border-gray-300 px-3"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full min-h-[44px] rounded bg-blue-600 text-white font-medium disabled:opacity-50"
        >
          {loading ? <Loading /> : "Create trip"}
        </button>
      </form>
    </div>
  );
}
