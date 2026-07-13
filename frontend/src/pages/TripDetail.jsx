import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "react-router-dom";

import { getTrip } from "../api/trips";
import { holdSeat, releaseHold } from "../api/holds";
import { useAuth } from "../context/AuthContext";
import Empty from "../components/states/Empty";
import ErrorState from "../components/states/ErrorState";
import Loading from "../components/states/Loading";
import SeatMap from "../components/SeatMap";
import HoldCountdown from "../components/HoldCountdown";

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

  return (
    <div className="max-w-md mx-auto px-4 py-10">
      <h1 className="font-heading text-2xl font-bold text-gray-900">
        {trip.origin} &rarr; {trip.destination}
      </h1>
      <p className="text-sm text-gray-600 mb-1">{new Date(trip.departure_time).toLocaleString()}</p>
      {trip.purpose && <p className="text-sm text-gray-600 mb-4">{trip.purpose}</p>}

      {seatTakenMessage && (
        <p role="status" className="mb-4 rounded-xl bg-primary-50 text-primary-800 px-3 py-2 text-sm">
          {seatTakenMessage}
        </p>
      )}

      <div className="card p-4">
        <SeatMap seats={trip.seats} onSeatClick={canHold ? handleSeatClick : undefined} />
      </div>

      {activeHold && (
        <div className="card p-4 mt-4 space-y-3">
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
  );
}
