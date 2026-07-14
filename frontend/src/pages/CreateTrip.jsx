import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  CalendarDaysIcon,
  CheckBadgeIcon,
  ClockIcon,
  LightBulbIcon,
  MapPinIcon,
  PlusCircleIcon,
  TagIcon,
  UsersIcon,
} from "@heroicons/react/24/outline";

import { createTrip } from "../api/trips";
import ErrorState from "../components/states/ErrorState";

const TIPS = [
  "Seats are created automatically, numbered 1 through your total seat count.",
  "Purpose is optional but helps riders find the right trip when searching (e.g. \"dialysis\", \"board exam\").",
  "Departure time is shown to riders in their local time zone.",
  "This platform is free — no payment details are ever collected.",
];

export default function CreateTrip() {
  const reduceMotion = useReducedMotion();
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

  const hasPreview = origin || destination || departureTime || purpose;

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="flex items-center gap-3 mb-8"
      >
        <motion.span
          whileHover={reduceMotion ? {} : { scale: 1.08, rotate: -4 }}
          transition={{ type: "spring", stiffness: 300, damping: 15 }}
          className="icon-badge bg-gradient-to-br from-primary-500 to-primary-700"
        >
          <PlusCircleIcon className="w-6 h-6 relative" aria-hidden="true" />
        </motion.span>
        <div>
          <h1 className="font-heading text-3xl font-bold text-gray-900">Create a trip</h1>
          <p className="text-sm text-gray-600">Publish a free shuttle trip for riders to find and book.</p>
        </div>
      </motion.div>

      <div className="grid gap-8 lg:grid-cols-2 items-start">
        <motion.form
          initial={reduceMotion ? false : { opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1, ease: "easeOut" }}
          onSubmit={handleSubmit}
          className="card p-6 space-y-4"
        >
          <AnimatePresence>
            {created && (
              <motion.p
                key="created"
                initial={reduceMotion ? false : { opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={reduceMotion ? {} : { opacity: 0, height: 0 }}
                role="status"
                className="rounded-xl bg-green-50 text-green-800 px-3 py-2 text-sm overflow-hidden"
              >
                Trip #{created.id} created with {created.total_seats} seats.
              </motion.p>
            )}
          </AnimatePresence>
          {error && <ErrorState message={error} />}

          <div>
            <label htmlFor="origin" className="field-label">
              Origin
            </label>
            <div className="input-icon-wrap">
              <MapPinIcon className="input-icon" aria-hidden="true" />
              <input
                id="origin"
                type="text"
                required
                value={origin}
                onChange={(e) => setOrigin(e.target.value)}
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
                required
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                className="input-field !mt-0 pl-10"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="departure_time" className="field-label">
                Departure time
              </label>
              <div className="input-icon-wrap">
                <CalendarDaysIcon className="input-icon" aria-hidden="true" />
                <input
                  id="departure_time"
                  type="datetime-local"
                  required
                  value={departureTime}
                  onChange={(e) => setDepartureTime(e.target.value)}
                  className="input-field !mt-0 pl-10"
                />
              </div>
            </div>

            <div>
              <label htmlFor="total_seats" className="field-label">
                Total seats
              </label>
              <div className="input-icon-wrap">
                <UsersIcon className="input-icon" aria-hidden="true" />
                <input
                  id="total_seats"
                  type="number"
                  min={1}
                  max={100}
                  required
                  value={totalSeats}
                  onChange={(e) => setTotalSeats(e.target.value)}
                  className="input-field !mt-0 pl-10"
                />
              </div>
            </div>
          </div>

          <div>
            <label htmlFor="purpose" className="field-label">
              Purpose (optional)
            </label>
            <div className="input-icon-wrap">
              <TagIcon className="input-icon" aria-hidden="true" />
              <input
                id="purpose"
                type="text"
                placeholder="e.g. medical, exam, work"
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                className="input-field !mt-0 pl-10"
              />
            </div>
          </div>

          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? "Creating…" : "Create trip"}
          </button>
        </motion.form>

        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2, ease: "easeOut" }}
          className="space-y-6"
        >
          <div>
            <h2 className="font-heading font-semibold text-gray-900 mb-3">Preview</h2>
            <AnimatePresence mode="wait">
              {hasPreview ? (
                <motion.div
                  key="preview"
                  initial={reduceMotion ? false : { opacity: 0, scale: 0.97 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={reduceMotion ? {} : { opacity: 0, scale: 0.97 }}
                  transition={{ duration: 0.25, ease: "easeOut" }}
                  className="card p-5"
                >
                  <p className="font-heading font-semibold text-gray-900 text-lg mb-3">
                    {origin || "Origin"} &rarr; {destination || "Destination"}
                  </p>
                  <div className="space-y-2 text-sm text-gray-600">
                    <p className="flex items-center gap-2">
                      <ClockIcon className="w-4 h-4 text-gray-400" aria-hidden="true" />
                      {departureTime ? new Date(departureTime).toLocaleString() : "Departure time"}
                    </p>
                    {purpose && (
                      <p className="flex items-center gap-2">
                        <TagIcon className="w-4 h-4 text-gray-400" aria-hidden="true" />
                        {purpose}
                      </p>
                    )}
                    <p className="flex items-center gap-2">
                      <UsersIcon className="w-4 h-4 text-gray-400" aria-hidden="true" />
                      {totalSeats || 0} seats will be created
                    </p>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="empty"
                  initial={reduceMotion ? false : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={reduceMotion ? {} : { opacity: 0 }}
                  transition={{ duration: 0.25 }}
                  className="card p-5 text-sm text-gray-500"
                >
                  Start filling in the form to see how your trip will look to riders.
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="card p-5">
            <h2 className="font-heading font-semibold text-gray-900 flex items-center gap-2 mb-3">
              <LightBulbIcon className="w-5 h-5 text-primary-600" aria-hidden="true" />
              Good to know
            </h2>
            <ul className="space-y-2">
              {TIPS.map((tip, i) => (
                <motion.li
                  key={tip}
                  initial={reduceMotion ? false : { opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, delay: reduceMotion ? 0 : 0.3 + i * 0.08, ease: "easeOut" }}
                  className="flex items-start gap-2 text-sm text-gray-600"
                >
                  <CheckBadgeIcon className="w-4 h-4 text-primary-500 mt-0.5 shrink-0" aria-hidden="true" />
                  {tip}
                </motion.li>
              ))}
            </ul>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
