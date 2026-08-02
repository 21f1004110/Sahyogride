import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { useReducedMotion } from "framer-motion";
import { CalendarDaysIcon, CheckCircleIcon, XCircleIcon } from "@heroicons/react/24/outline";

import { cancelReservation } from "../api/booking";
import Empty from "../components/states/Empty";
import ErrorState from "../components/states/ErrorState";
import StatusTimeline from "../components/StatusTimeline";
import VehicleTracker from "../components/VehicleTracker";
import Fireworks from "../components/Fireworks";

export default function Confirmation() {
  const location = useLocation();
  const reduceMotion = useReducedMotion();
  const { reservation, trip } = location.state || {};
  const [status, setStatus] = useState(reservation?.status);
  const [cancelledAt, setCancelledAt] = useState(reservation?.cancelled_at ?? null);
  const [cancelError, setCancelError] = useState(null);

  // Celebrate the actual confirmed moment (SAHYOG-41), not the earlier
  // provisional hold - fires once on mount, only for a freshly-confirmed
  // (never a cancelled) reservation.
  const [celebrating, setCelebrating] = useState(
    () => !reduceMotion && reservation?.status === "confirmed",
  );

  useEffect(() => {
    if (!celebrating) return;
    const timeout = setTimeout(() => setCelebrating(false), 1500);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cancelMutation = useMutation({
    mutationFn: () => cancelReservation(reservation.id),
    onSuccess: (updated) => {
      setStatus(updated.status);
      setCancelledAt(updated.cancelled_at);
    },
    onError: () => {
      setCancelError("Couldn't cancel your reservation. Please try again.");
    },
  });

  if (!reservation) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center">
        <Empty message="No reservation to show. Search for a trip to book a seat." />
        <Link to="/trips" className="btn-primary mt-4 inline-flex">
          Search trips
        </Link>
      </div>
    );
  }

  const seatNumber =
    trip?.seats?.find((s) => s.id === reservation.seat_id)?.seat_number ?? reservation.seat_id;
  const isCancelled = status === "cancelled";

  return (
    <div className="relative max-w-md mx-auto px-4 py-16 text-center">
      {celebrating && (
        <div className="absolute inset-0 pointer-events-none z-10">
          <Fireworks className="pointer-events-none" />
        </div>
      )}

      {isCancelled ? (
        <span className="icon-badge bg-gradient-to-br from-gray-400 to-gray-500 mx-auto mb-4">
          <XCircleIcon className="w-6 h-6 relative" aria-hidden="true" />
        </span>
      ) : (
        <span className="icon-badge bg-gradient-to-br from-green-500 to-emerald-600 mx-auto mb-4">
          <CheckCircleIcon className="w-6 h-6 relative" aria-hidden="true" />
        </span>
      )}

      <h1 className="font-heading text-2xl font-bold text-gray-900">
        {isCancelled ? "Reservation cancelled" : "Seat confirmed"}
      </h1>
      <p className="mt-2 text-gray-600">
        {isCancelled
          ? `Seat ${seatNumber} has been released and is available for someone else.`
          : `Seat ${seatNumber} is yours${trip ? ` for ${trip.origin} → ${trip.destination}` : ""}.`}
      </p>

      <div className="card p-5 mt-6 text-left space-y-2">
        {trip?.departure_time && (
          <p className="flex items-center gap-2 text-sm text-gray-700">
            <CalendarDaysIcon className="w-5 h-5 text-gray-400 shrink-0" aria-hidden="true" />
            {new Date(trip.departure_time).toLocaleString()}
          </p>
        )}
        <p className="text-sm text-gray-500">
          {isCancelled
            ? `Cancelled ${new Date(cancelledAt).toLocaleString()}`
            : `Confirmed ${new Date(reservation.confirmed_at).toLocaleString()}`}
        </p>
      </div>

      {trip?.departure_time && (
        <div className="card p-5 mt-4">
          <StatusTimeline departureTime={trip.departure_time} cancelled={isCancelled} />
        </div>
      )}

      {!isCancelled && trip?.departure_time && (
        <div className="mt-4">
          <VehicleTracker
            tripId={trip.id}
            origin={trip.origin}
            destination={trip.destination}
            departureTime={trip.departure_time}
          />
        </div>
      )}

      {cancelError && (
        <div className="mt-4 text-left">
          <ErrorState message={cancelError} />
        </div>
      )}

      {!isCancelled && (
        <button
          type="button"
          onClick={() => {
            setCancelError(null);
            cancelMutation.mutate();
          }}
          disabled={cancelMutation.isPending}
          className="btn-secondary mt-6 w-full"
        >
          {cancelMutation.isPending ? "Cancelling…" : "Cancel reservation"}
        </button>
      )}

      <Link to="/trips" className="btn-primary mt-3 w-full">
        Find another trip
      </Link>
    </div>
  );
}
