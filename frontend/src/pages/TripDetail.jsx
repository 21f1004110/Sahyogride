import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { CalendarDaysIcon, TagIcon, UsersIcon } from "@heroicons/react/24/outline";

import { getTrip } from "../api/trips";
import { holdSeat, releaseHold } from "../api/holds";
import { useAuth } from "../context/AuthContext";
import Empty from "../components/states/Empty";
import ErrorState from "../components/states/ErrorState";
import Loading from "../components/states/Loading";
import SeatMap from "../components/SeatMap";
import { STATUS_STYLES } from "../components/Seat";
import HoldCountdown from "../components/HoldCountdown";

function SeatLegend() {
  return (
    <ul className="space-y-2">
      {Object.entries(STATUS_STYLES).map(([status, { icon, label, classes }]) => (
        <li key={status} className="flex items-center gap-2 text-sm text-gray-600">
          <span
            aria-hidden="true"
            className={`w-6 h-6 rounded-md border flex items-center justify-center text-xs ${classes}`}
          >
            {icon}
          </span>
          {label}
        </li>
      ))}
    </ul>
  );
}

export default function TripDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeHold, setActiveHold] = useState(null);
  const [seatTakenMessage, setSeatTakenMessage] = useState(null);

  const { data: trip, isLoading, isError, refetch } = useQuery({
    queryKey: ["trip", id],
    queryFn: () => getTrip(id),
  });

  const holdMutation = useMutation({
    mutationFn: (seatId) => holdSeat(seatId),
    onSuccess: (hold) => {
      setSeatTakenMessage(null);
      setActiveHold({ holdId: hold.id, seatId: hold.seat_id, expiresAt: hold.expires_at });
      queryClient.invalidateQueries({ queryKey: ["trip", id] });
    },
    onError: (err) => {
      if (err.response?.status === 409) {
        setSeatTakenMessage("That seat was just taken — please pick another one.");
        queryClient.invalidateQueries({ queryKey: ["trip", id] });
      }
    },
  });

  const releaseMutation = useMutation({
    mutationFn: (holdId) => releaseHold(holdId),
    onSuccess: () => {
      setActiveHold(null);
      queryClient.invalidateQueries({ queryKey: ["trip", id] });
    },
  });

  if (isLoading) return <Loading />;
  if (isError) return <ErrorState message="Couldn't load this trip." onRetry={refetch} />;
  if (!trip.seats.length) return <Empty message="This trip has no seats." />;

  const canHold = user?.role === "rider";

  function handleSeatClick(seat) {
    setSeatTakenMessage(null);
    holdMutation.mutate(seat.id);
  }

  const counts = trip.seats.reduce(
    (acc, seat) => ({ ...acc, [seat.status]: (acc[seat.status] || 0) + 1 }),
    {},
  );

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      <h1 className="font-heading text-3xl font-bold text-gray-900">
        {trip.origin} &rarr; {trip.destination}
      </h1>

      <div className="grid gap-8 lg:grid-cols-[320px_1fr] mt-6 items-start">
        <div className="space-y-6 lg:sticky lg:top-24">
          <div className="card p-5 space-y-3">
            <p className="flex items-center gap-2 text-sm text-gray-700">
              <CalendarDaysIcon className="w-5 h-5 text-gray-400" aria-hidden="true" />
              {new Date(trip.departure_time).toLocaleString()}
            </p>
            {trip.purpose && (
              <p className="flex items-center gap-2 text-sm text-gray-700">
                <TagIcon className="w-5 h-5 text-gray-400" aria-hidden="true" />
                {trip.purpose}
              </p>
            )}
            <p className="flex items-center gap-2 text-sm text-gray-700">
              <UsersIcon className="w-5 h-5 text-gray-400" aria-hidden="true" />
              {trip.total_seats} total seats
            </p>
          </div>

          <div className="card p-5">
            <h2 className="font-heading font-semibold text-gray-900 mb-3">Seat status</h2>
            <SeatLegend />
            <dl className="mt-4 pt-4 border-t border-gray-100 space-y-1 text-sm text-gray-600">
              {Object.entries(STATUS_STYLES).map(([status, { label }]) => (
                <div key={status} className="flex justify-between">
                  <dt>{label}</dt>
                  <dd className="font-medium text-gray-900">{counts[status] || 0}</dd>
                </div>
              ))}
            </dl>
          </div>

          {activeHold && (
            <div className="card p-5 space-y-3">
              <HoldCountdown expiresAt={activeHold.expiresAt} />
              <button
                type="button"
                onClick={() => releaseMutation.mutate(activeHold.holdId)}
                className="btn-secondary w-full"
              >
                Release seat
              </button>
            </div>
          )}
        </div>

        <div>
          {seatTakenMessage && (
            <p role="status" className="mb-4 rounded-xl bg-primary-50 text-primary-800 px-3 py-2 text-sm">
              {seatTakenMessage}
            </p>
          )}

          <div className="card p-6">
            <h2 className="font-heading font-semibold text-gray-900 mb-4">
              {canHold ? "Tap an available seat to hold it" : "Seat map"}
            </h2>
            <SeatMap seats={trip.seats} onSeatClick={canHold ? handleSeatClick : undefined} />
          </div>
        </div>
      </div>
    </div>
  );
}
