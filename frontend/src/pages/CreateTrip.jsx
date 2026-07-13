import { useState } from "react";

import { createTrip } from "../api/trips";
import ErrorState from "../components/states/ErrorState";

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
    <div className="max-w-sm mx-auto px-4 py-10">
      <form onSubmit={handleSubmit} className="card p-6 space-y-4">
        <h1 className="font-heading text-2xl font-bold text-gray-900">Create a trip</h1>

        {created && (
          <p role="status" className="rounded-xl bg-green-50 text-green-800 px-3 py-2 text-sm">
            Trip #{created.id} created with {created.total_seats} seats.
          </p>
        )}
        {error && <ErrorState message={error} />}

        <div>
          <label htmlFor="origin" className="field-label">
            Origin
          </label>
          <input
            id="origin"
            type="text"
            required
            value={origin}
            onChange={(e) => setOrigin(e.target.value)}
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
            required
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            className="input-field"
          />
        </div>

        <div>
          <label htmlFor="departure_time" className="field-label">
            Departure time
          </label>
          <input
            id="departure_time"
            type="datetime-local"
            required
            value={departureTime}
            onChange={(e) => setDepartureTime(e.target.value)}
            className="input-field"
          />
        </div>

        <div>
          <label htmlFor="total_seats" className="field-label">
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
            className="input-field"
          />
        </div>

        <div>
          <label htmlFor="purpose" className="field-label">
            Purpose (optional)
          </label>
          <input
            id="purpose"
            type="text"
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            className="input-field"
          />
        </div>

        <button type="submit" disabled={loading} className="btn-primary w-full">
          {loading ? "Creating…" : "Create trip"}
        </button>
      </form>
    </div>
  );
}
