import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";

import { getTrip } from "../api/trips";
import Empty from "../components/states/Empty";
import ErrorState from "../components/states/ErrorState";
import Loading from "../components/states/Loading";
import SeatMap from "../components/SeatMap";

export default function TripDetail() {
  const { id } = useParams();
  const { data: trip, isLoading, isError, refetch } = useQuery({
    queryKey: ["trip", id],
    queryFn: () => getTrip(id),
  });

  if (isLoading) return <Loading />;
  if (isError) return <ErrorState message="Couldn't load this trip." onRetry={refetch} />;
  if (!trip.seats.length) return <Empty message="This trip has no seats." />;

  return (
    <div className="min-h-screen px-4 py-6 max-w-md mx-auto">
      <h1 className="text-2xl font-semibold">
        {trip.origin} &rarr; {trip.destination}
      </h1>
      <p className="text-sm text-gray-600 mb-1">{new Date(trip.departure_time).toLocaleString()}</p>
      {trip.purpose && <p className="text-sm text-gray-600 mb-4">{trip.purpose}</p>}

      <SeatMap seats={trip.seats} />
    </div>
  );
}
