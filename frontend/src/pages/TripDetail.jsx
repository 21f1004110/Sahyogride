import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { CalendarDaysIcon, MapIcon, SparklesIcon, TagIcon, UsersIcon } from "@heroicons/react/24/outline";

import { getSimilarTrips, getTrip } from "../api/trips";
import { holdSeat, releaseHold } from "../api/holds";
import { confirmReservation } from "../api/booking";
import { recommendSeat } from "../api/ai";
import { useAuth } from "../context/AuthContext";
import Empty from "../components/states/Empty";
import ErrorState from "../components/states/ErrorState";
import { TripDetailSkeleton } from "../components/states/Loading";
import SeatMap from "../components/SeatMap";
import { STATUS_STYLES } from "../components/Seat";
import HoldCountdown from "../components/HoldCountdown";
import SimilarTrips from "../components/SimilarTrips";
import AnimatedNumber from "../components/AnimatedNumber";

const LOW_SEATS_THRESHOLD = 2;

function SeatLegend({ counts }) {
  return (
    <ul className="space-y-2.5">
      {Object.entries(STATUS_STYLES).map(([status, { icon, label, classes }]) => (
        <li key={status} className="flex items-center justify-between gap-2 text-sm text-gray-600">
          <span className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className={`w-6 h-6 rounded-md border flex items-center justify-center text-xs ${classes}`}
            >
              {icon}
            </span>
            {label}
          </span>
          <span className="font-medium text-gray-900 tabular-nums">
            <AnimatedNumber value={counts[status] || 0} />
          </span>
        </li>
      ))}
    </ul>
  );
}

export default function TripDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const reduceMotion = useReducedMotion();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeHold, setActiveHold] = useState(null);
  const [seatTakenMessage, setSeatTakenMessage] = useState(null);
  const [confirmError, setConfirmError] = useState(null);
  const [seatNote, setSeatNote] = useState("");
  const [suggestion, setSuggestion] = useState(null);
  const [accessibilityNote, setAccessibilityNote] = useState("");
  const [passengerName, setPassengerName] = useState(user?.name || "");
  const [passengerPhone, setPassengerPhone] = useState("");

  const { data: trip, isLoading, isError, refetch } = useQuery({
    queryKey: ["trip", id],
    queryFn: () => getTrip(id),
    // Keeps the seat map feeling shared/live across viewers (SAHYOG-35) -
    // GET /trips/{id} already returns live seat state, this just polls it.
    refetchInterval: 5000,
    refetchIntervalInBackground: false,
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

  const confirmMutation = useMutation({
    mutationFn: ({ holdId, notes, passengerName, passengerPhone }) =>
      confirmReservation(holdId, notes, passengerName, passengerPhone),
    onSuccess: (reservation) => {
      navigate("/confirmation", { state: { reservation, trip } });
    },
    onError: (err) => {
      const code = err.response?.data?.error?.code;
      if (code === "HOLD_EXPIRED") {
        setActiveHold(null);
        setConfirmError("Your hold expired before you confirmed — please pick a seat again.");
      } else {
        setConfirmError("Couldn't confirm your reservation. Please try again.");
      }
      queryClient.invalidateQueries({ queryKey: ["trip", id] });
    },
  });

  const suggestMutation = useMutation({
    mutationFn: (note) => recommendSeat(id, note),
    onSuccess: (data) => setSuggestion(data),
  });

  const seatsAvailable = trip?.seats?.filter((s) => s.status === "available").length ?? null;

  const { data: similarTrips } = useQuery({
    queryKey: ["similar-trips", id],
    queryFn: () => getSimilarTrips(id),
    enabled: seatsAvailable !== null && seatsAvailable <= LOW_SEATS_THRESHOLD,
  });

  if (isLoading) return <TripDetailSkeleton />;
  if (isError) return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      <ErrorState message="Couldn't load this trip." onRetry={refetch} />
    </div>
  );
  if (!trip.seats.length) return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      <Empty message="This trip has no seats." />
    </div>
  );

  const canHold = user?.role === "rider";

  function handleSeatClick(seat) {
    setSeatTakenMessage(null);
    holdMutation.mutate(seat.id);
  }

  const counts = trip.seats.reduce(
    (acc, seat) => ({ ...acc, [seat.status]: (acc[seat.status] || 0) + 1 }),
    {},
  );

  const suggestedSeat = suggestion?.seat_number
    ? trip.seats.find((s) => s.seat_number === suggestion.seat_number)
    : null;

  function handleSuggestSubmit(e) {
    e.preventDefault();
    const trimmed = seatNote.trim();
    if (!trimmed) return;
    suggestMutation.mutate(trimmed);
  }

  const trimmedPassengerName = passengerName.trim();
  const trimmedPassengerPhone = passengerPhone.trim();
  const phoneDigitCount = trimmedPassengerPhone.replace(/\D/g, "").length;
  const contactDetailsValid = trimmedPassengerName.length > 0 && phoneDigitCount >= 7;

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className="flex items-center gap-3"
      >
        <span className="icon-badge bg-gradient-to-br from-primary-500 to-primary-700">
          <MapIcon className="w-6 h-6 relative" aria-hidden="true" />
        </span>
        <h1 className="font-heading text-2xl sm:text-3xl font-bold text-gray-900">
          {trip.origin} <span className="text-gray-300 mx-1">&rarr;</span> {trip.destination}
        </h1>
      </motion.div>

      <div className="grid gap-8 lg:grid-cols-[320px_1fr] mt-6 items-start">
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, x: -16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.35, delay: 0.08, ease: "easeOut" }}
          className="space-y-6 lg:sticky lg:top-24"
        >
          <div className="card p-5 space-y-3">
            {trip.ai_summary && (
              <p className="flex items-start gap-2 text-sm text-primary-700 pb-1">
                <SparklesIcon className="w-5 h-5 shrink-0 mt-0.5" aria-hidden="true" />
                <span>{trip.ai_summary}</span>
              </p>
            )}
            <p className="flex items-center gap-2 text-sm text-gray-700">
              <CalendarDaysIcon className="w-5 h-5 text-gray-400 shrink-0" aria-hidden="true" />
              {new Date(trip.departure_time).toLocaleString()}
            </p>
            {trip.purpose && (
              <p className="flex items-center gap-2 text-sm text-gray-700">
                <TagIcon className="w-5 h-5 text-gray-400 shrink-0" aria-hidden="true" />
                {trip.purpose}
              </p>
            )}
            <p className="flex items-center gap-2 text-sm text-gray-700">
              <UsersIcon className="w-5 h-5 text-gray-400 shrink-0" aria-hidden="true" />
              {trip.total_seats} total seats
            </p>
          </div>

          <div className="card p-5">
            <h2 className="font-heading font-semibold text-gray-900 mb-3">Seat status</h2>
            <SeatLegend counts={counts} />
          </div>

          {activeHold && (
            <motion.div
              initial={reduceMotion ? false : { opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className="card p-5 space-y-3 border-primary-200 ring-1 ring-primary-100"
            >
              <HoldCountdown expiresAt={activeHold.expiresAt} />
              <div>
                <label htmlFor="passenger-name" className="field-label">
                  Passenger name
                </label>
                <input
                  id="passenger-name"
                  type="text"
                  value={passengerName}
                  onChange={(e) => setPassengerName(e.target.value)}
                  placeholder="Who is travelling?"
                  maxLength={120}
                  required
                  className="input-field !mt-1"
                />
              </div>
              <div>
                <label htmlFor="passenger-phone" className="field-label">
                  Contact phone number
                </label>
                <input
                  id="passenger-phone"
                  type="tel"
                  value={passengerPhone}
                  onChange={(e) => setPassengerPhone(e.target.value)}
                  placeholder="So the coordinator can reach you"
                  maxLength={20}
                  required
                  className="input-field !mt-1"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Needed so the trip coordinator can contact you about this seat.
                </p>
              </div>
              <div>
                <label htmlFor="accessibility-note" className="field-label">
                  Anything we should know? (optional)
                </label>
                <textarea
                  id="accessibility-note"
                  value={accessibilityNote}
                  onChange={(e) => setAccessibilityNote(e.target.value)}
                  placeholder="e.g. I use a wheelchair, travelling with a toddler…"
                  rows={2}
                  maxLength={500}
                  className="input-field !mt-1 resize-none"
                />
              </div>
              <button
                type="button"
                onClick={() => {
                  setConfirmError(null);
                  confirmMutation.mutate({
                    holdId: activeHold.holdId,
                    notes: accessibilityNote,
                    passengerName: trimmedPassengerName,
                    passengerPhone: trimmedPassengerPhone,
                  });
                }}
                disabled={confirmMutation.isPending || !contactDetailsValid}
                className="btn-primary w-full"
              >
                {confirmMutation.isPending ? "Confirming…" : "Confirm reservation"}
              </button>
              {!contactDetailsValid && (
                <p className="text-xs text-gray-500">
                  Enter a name and a phone number (at least 7 digits) to confirm.
                </p>
              )}
              <button
                type="button"
                onClick={() => releaseMutation.mutate(activeHold.holdId)}
                disabled={confirmMutation.isPending}
                className="btn-secondary w-full"
              >
                Release seat
              </button>
              {confirmError && (
                <p role="status" className="text-sm text-amber-700">
                  {confirmError}
                </p>
              )}
            </motion.div>
          )}
        </motion.div>

        <motion.div
          initial={reduceMotion ? false : { opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.35, delay: 0.12, ease: "easeOut" }}
        >
          {seatTakenMessage && (
            <motion.p
              initial={reduceMotion ? false : { opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              role="status"
              className="mb-4 rounded-xl bg-primary-50 text-primary-800 px-3 py-2 text-sm"
            >
              {seatTakenMessage}
            </motion.p>
          )}

          {canHold && (
            <div className="card p-5 mb-6">
              <h2 className="font-heading font-semibold text-gray-900 flex items-center gap-2 mb-1">
                <SparklesIcon className="w-5 h-5 text-primary-600" aria-hidden="true" />
                Want a seat suggestion?
              </h2>
              <p className="text-sm text-gray-500 mb-3">
                e.g. &ldquo;I use a wheelchair&rdquo; or &ldquo;travelling with a toddler&rdquo; — this
                only highlights a seat, you still have to click it yourself.
              </p>
              <form onSubmit={handleSuggestSubmit} className="flex gap-2">
                <input
                  type="text"
                  value={seatNote}
                  onChange={(e) => setSeatNote(e.target.value)}
                  placeholder="Tell us what you need…"
                  aria-label="Describe what you need in a seat"
                  className="input-field !mt-0 flex-1"
                />
                <button type="submit" disabled={suggestMutation.isPending} className="btn-primary shrink-0">
                  {suggestMutation.isPending ? "Thinking…" : "Suggest"}
                </button>
              </form>
              {suggestion && (
                <p className="text-sm text-gray-600 mt-3">
                  {suggestion.seat_number ? (
                    <>
                      Seat <span className="font-semibold text-gray-900">{suggestion.seat_number}</span>
                      {suggestion.reason ? ` — ${suggestion.reason}` : ""}{" "}
                      <span className="text-xs text-gray-400">
                        ({suggestion.fallback ? "nearest available" : "suggested by AI"})
                      </span>
                    </>
                  ) : (
                    "No seats available to suggest right now."
                  )}
                </p>
              )}
            </div>
          )}

          <div className="card p-6">
            <h2 className="font-heading font-semibold text-gray-900 mb-4">
              {canHold ? "Tap an available seat to hold it" : "Seat map"}
            </h2>
            <SeatMap
              seats={trip.seats}
              onSeatClick={canHold ? handleSeatClick : undefined}
              pendingSeatId={holdMutation.isPending ? holdMutation.variables : null}
              suggestedSeatId={suggestedSeat?.id ?? null}
              suggestionReason={suggestion?.reason}
            />
          </div>

          {similarTrips?.trips?.length > 0 && (
            <div className="mt-6">
              <SimilarTrips trips={similarTrips.trips} fallback={similarTrips.fallback} />
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
