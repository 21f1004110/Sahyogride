import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, useReducedMotion } from "framer-motion";

import { cancelReservation, getMyReservations } from "../api/booking";
import Empty from "../components/states/Empty";
import ErrorState from "../components/states/ErrorState";
import Loading from "../components/states/Loading";

const STATUS_BADGE = {
  confirmed: "bg-green-100 text-green-800",
  cancelled: "bg-gray-200 text-gray-600",
};

export default function MyReservations() {
  const queryClient = useQueryClient();
  const reduceMotion = useReducedMotion();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["my-reservations"],
    queryFn: getMyReservations,
  });

  const cancelMutation = useMutation({
    mutationFn: (reservationId) => cancelReservation(reservationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-reservations"] });
    },
  });

  if (isLoading) return <Loading />;
  if (isError) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-10">
        <ErrorState message="Couldn't load your reservations." onRetry={refetch} />
      </div>
    );
  }

  const reservations = data.reservations;

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <h1 className="font-heading text-3xl font-bold text-gray-900 mb-6">My reservations</h1>

      {reservations.length === 0 ? (
        <div className="text-center">
          <Empty message="You haven't reserved a seat yet." />
          <Link to="/trips" className="btn-primary mt-2 inline-flex">
            Search trips
          </Link>
        </div>
      ) : (
        <ul className="space-y-4">
          {reservations.map((r, i) => (
            <motion.li
              key={r.id}
              initial={reduceMotion ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: reduceMotion ? 0 : i * 0.05, ease: "easeOut" }}
              className="card p-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <Link
                  to={`/trips/${r.trip_id}`}
                  className="font-heading font-semibold text-gray-900 hover:text-primary-600 break-words"
                >
                  Trip #{r.trip_id} &middot; Seat {r.seat_number}
                </Link>
                <p className="text-sm text-gray-500 mt-1">
                  {r.status === "cancelled"
                    ? `Cancelled ${new Date(r.cancelled_at).toLocaleString()}`
                    : `Confirmed ${new Date(r.confirmed_at).toLocaleString()}`}
                </p>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <span
                  className={`text-xs font-medium px-2.5 py-1 rounded-full capitalize ${STATUS_BADGE[r.status]}`}
                >
                  {r.status}
                </span>
                {r.status === "confirmed" && (
                  <button
                    type="button"
                    onClick={() => cancelMutation.mutate(r.id)}
                    disabled={cancelMutation.isPending}
                    className="btn-secondary"
                  >
                    {cancelMutation.isPending && cancelMutation.variables === r.id
                      ? "Cancelling…"
                      : "Cancel"}
                  </button>
                )}
              </div>
            </motion.li>
          ))}
        </ul>
      )}
    </div>
  );
}
