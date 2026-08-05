import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowLeftIcon,
  CheckCircleIcon,
  MapPinIcon,
  PlusIcon,
  SparklesIcon,
  TrashIcon,
  TruckIcon,
} from "@heroicons/react/24/outline";

import { getTrip, setBusStops, setCurrentStop } from "../api/trips";
import Empty from "../components/states/Empty";
import ErrorState from "../components/states/ErrorState";
import Loading from "../components/states/Loading";

export default function ManageStops() {
  const { id } = useParams();
  const reduceMotion = useReducedMotion();
  const queryClient = useQueryClient();
  const [stopNames, setStopNames] = useState([]);
  const [initialized, setInitialized] = useState(false);

  const { data: trip, isLoading, isError, refetch } = useQuery({
    queryKey: ["trip", id],
    queryFn: () => getTrip(id),
  });

  // Seed the editable list from whatever's already saved, once - after
  // that, local edits are the source of truth until Save is pressed.
  useEffect(() => {
    if (trip && !initialized) {
      setStopNames(trip.bus_stops.length > 0 ? trip.bus_stops.map((s) => s.name) : ["", ""]);
      setInitialized(true);
    }
  }, [trip, initialized]);

  const saveMutation = useMutation({
    mutationFn: (names) => setBusStops(id, names),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["trip", id] }),
  });

  const currentStopMutation = useMutation({
    mutationFn: (sequence) => setCurrentStop(id, sequence),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["trip", id] }),
  });

  if (isLoading) return <Loading />;
  if (isError) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-10">
        <ErrorState message="Couldn't load this trip." onRetry={refetch} />
      </div>
    );
  }

  function updateStopName(index, value) {
    setStopNames((prev) => prev.map((name, i) => (i === index ? value : name)));
  }

  function removeStop(index) {
    setStopNames((prev) => prev.filter((_, i) => i !== index));
  }

  function addStop() {
    setStopNames((prev) => [...prev, ""]);
  }

  function fillDummyRoute() {
    setStopNames([trip.origin, "Market Square", "Town Hall", trip.destination]);
  }

  function handleSave(e) {
    e.preventDefault();
    const cleaned = stopNames.map((n) => n.trim()).filter(Boolean);
    if (cleaned.length === 0) return;
    saveMutation.mutate(cleaned);
  }

  const hasStops = trip.bus_stops.length > 0;

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <Link
        to="/my-trips"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 mb-4"
      >
        <ArrowLeftIcon className="w-4 h-4" aria-hidden="true" />
        My trips
      </Link>

      <div className="flex items-center gap-3 mb-6">
        <span className="icon-badge bg-gradient-to-br from-primary-500 to-primary-700">
          <TruckIcon className="w-6 h-6 relative" aria-hidden="true" />
        </span>
        <div>
          <h1 className="font-heading text-3xl font-bold text-gray-900">Bus stops &amp; live status</h1>
          <p className="text-sm text-gray-600">
            {trip.origin} &rarr; {trip.destination}
          </p>
        </div>
      </div>

      <form onSubmit={handleSave} className="card p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-heading font-semibold text-gray-900">Route</h2>
          <button
            type="button"
            onClick={fillDummyRoute}
            className="flex items-center gap-1 text-xs font-medium text-primary-700 hover:text-primary-900"
          >
            <SparklesIcon className="w-3.5 h-3.5" aria-hidden="true" />
            Fill with sample stops
          </button>
        </div>
        <p className="text-sm text-gray-500">
          List stops in order, from the boarding point to the destination. Riders will see this list and
          which stop the vehicle is currently at.
        </p>

        <ol className="space-y-2">
          {stopNames.map((name, i) => (
            <li key={i} className="flex items-center gap-2">
              <span className="w-6 text-xs font-semibold text-gray-400 text-center shrink-0">{i + 1}</span>
              <div className="input-icon-wrap flex-1">
                <MapPinIcon className="input-icon" aria-hidden="true" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => updateStopName(i, e.target.value)}
                  placeholder={i === 0 ? "Boarding point" : i === stopNames.length - 1 ? "Destination" : "Stop name"}
                  className="input-field !mt-0 pl-10"
                />
              </div>
              <button
                type="button"
                onClick={() => removeStop(i)}
                disabled={stopNames.length <= 1}
                aria-label={`Remove stop ${i + 1}`}
                className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-30 transition shrink-0"
              >
                <TrashIcon className="w-4 h-4" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ol>

        <button
          type="button"
          onClick={addStop}
          className="flex items-center gap-1.5 text-sm font-medium text-primary-700 hover:text-primary-900"
        >
          <PlusIcon className="w-4 h-4" aria-hidden="true" />
          Add stop
        </button>

        <button type="submit" disabled={saveMutation.isPending} className="btn-primary w-full">
          {saveMutation.isPending ? "Saving…" : "Save route"}
        </button>

        {saveMutation.isError && (
          <ErrorState message="Couldn't save the route. Please try again." onRetry={() => saveMutation.mutate(stopNames.map((n) => n.trim()).filter(Boolean))} />
        )}
      </form>

      <div className="card p-5 mt-6">
        <h2 className="font-heading font-semibold text-gray-900 mb-1">Current vehicle position</h2>
        {!hasStops ? (
          <Empty message="Save a route above to start setting the vehicle's live position." />
        ) : (
          <>
            <p className="text-sm text-gray-500 mb-4">
              Tap the stop the vehicle is at right now — riders see this update within a few seconds.
            </p>
            <ol className="space-y-2">
              {trip.bus_stops.map((stop, i) => {
                const isCurrent = trip.current_stop_sequence === stop.sequence;
                const isPast = trip.current_stop_sequence !== null && stop.sequence < trip.current_stop_sequence;
                return (
                  <motion.li key={stop.id} layout={!reduceMotion}>
                    <button
                      type="button"
                      onClick={() => currentStopMutation.mutate(stop.sequence)}
                      disabled={currentStopMutation.isPending}
                      aria-pressed={isCurrent}
                      className={`w-full flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition ${
                        isCurrent
                          ? "border-primary-400 bg-primary-50 ring-1 ring-primary-200"
                          : isPast
                            ? "border-gray-200 bg-gray-50 text-gray-400"
                            : "border-gray-200 hover:border-primary-300 hover:bg-primary-50/40"
                      }`}
                    >
                      {isCurrent ? (
                        <TruckIcon className="w-5 h-5 text-primary-600 shrink-0" aria-hidden="true" />
                      ) : isPast ? (
                        <CheckCircleIcon className="w-5 h-5 text-gray-300 shrink-0" aria-hidden="true" />
                      ) : (
                        <MapPinIcon className="w-5 h-5 text-gray-300 shrink-0" aria-hidden="true" />
                      )}
                      <span className={`font-medium ${isCurrent ? "text-primary-900" : "text-gray-700"}`}>
                        {stop.name}
                      </span>
                      {isCurrent && (
                        <span className="ml-auto text-xs font-semibold text-primary-600 uppercase tracking-wide">
                          Current
                        </span>
                      )}
                    </button>
                  </motion.li>
                );
              })}
            </ol>
          </>
        )}
      </div>
    </div>
  );
}
