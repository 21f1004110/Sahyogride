import { Link, useLocation } from "react-router-dom";
import { CalendarDaysIcon, CheckCircleIcon } from "@heroicons/react/24/outline";

import Empty from "../components/states/Empty";

export default function Confirmation() {
  const location = useLocation();
  const { reservation, trip } = location.state || {};

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

  return (
    <div className="max-w-md mx-auto px-4 py-16 text-center">
      <span className="icon-badge bg-gradient-to-br from-green-500 to-emerald-600 mx-auto mb-4">
        <CheckCircleIcon className="w-6 h-6 relative" aria-hidden="true" />
      </span>
      <h1 className="font-heading text-2xl font-bold text-gray-900">Seat confirmed</h1>
      <p className="mt-2 text-gray-600">
        Seat {trip?.seats?.find((s) => s.id === reservation.seat_id)?.seat_number ?? reservation.seat_id} is
        yours{trip ? ` for ${trip.origin} → ${trip.destination}` : ""}.
      </p>

      <div className="card p-5 mt-6 text-left space-y-2">
        {trip?.departure_time && (
          <p className="flex items-center gap-2 text-sm text-gray-700">
            <CalendarDaysIcon className="w-5 h-5 text-gray-400 shrink-0" aria-hidden="true" />
            {new Date(trip.departure_time).toLocaleString()}
          </p>
        )}
        <p className="text-sm text-gray-500">
          Confirmed {new Date(reservation.confirmed_at).toLocaleString()}
        </p>
      </div>

      <Link to="/trips" className="btn-primary mt-6 w-full">
        Find another trip
      </Link>
    </div>
  );
}
