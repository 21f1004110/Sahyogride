import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowsPointingOutIcon,
  CheckCircleIcon,
  MapPinIcon,
  TruckIcon,
} from "@heroicons/react/24/outline";

import { getTrip } from "../api/trips";
import Empty from "./states/Empty";
import GeoMap from "./GeoMap";
import Modal from "./Modal";

// Live, coordinator-driven position (SAHYOG-46) - polls the same
// GET /trips/{id} the seat map already polls (SAHYOG-35), no separate
// endpoint needed. Not GPS/maps: current_stop_sequence is a plain index
// the coordinator sets by hand from ManageStops.jsx.
const POLL_MS = 5000;

function StopList({ stops, currentSequence, reduceMotion }) {
  return (
    <ol className="space-y-2">
      {stops.map((stop) => {
        const isCurrent = currentSequence === stop.sequence;
        const isPast = currentSequence !== null && stop.sequence < currentSequence;
        return (
          <motion.li
            key={stop.id}
            layout={!reduceMotion}
            className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm ${
              isCurrent ? "bg-primary-50 ring-1 ring-primary-200" : ""
            }`}
          >
            {isCurrent ? (
              <TruckIcon className="w-4 h-4 text-primary-600 shrink-0" aria-hidden="true" />
            ) : isPast ? (
              <CheckCircleIcon className="w-4 h-4 text-gray-300 shrink-0" aria-hidden="true" />
            ) : (
              <MapPinIcon className="w-4 h-4 text-gray-300 shrink-0" aria-hidden="true" />
            )}
            <span
              className={isCurrent ? "font-semibold text-primary-900" : isPast ? "text-gray-400" : "text-gray-600"}
            >
              {stop.name}
            </span>
          </motion.li>
        );
      })}
    </ol>
  );
}

export default function BusStopTracker({ tripId }) {
  const reduceMotion = useReducedMotion();
  const [zoomed, setZoomed] = useState(false);

  const { data: trip } = useQuery({
    queryKey: ["trip", String(tripId)],
    queryFn: () => getTrip(tripId),
    refetchInterval: POLL_MS,
    refetchIntervalInBackground: false,
  });

  if (!trip) return null;

  if (trip.bus_stops.length === 0) {
    return (
      <div className="card p-5">
        <h2 className="font-heading font-semibold text-gray-900 mb-2">Live vehicle tracker</h2>
        <Empty message="The coordinator hasn't set up live tracking for this trip yet." />
      </div>
    );
  }

  const currentSequence = trip.current_stop_sequence;
  const currentStop = trip.bus_stops.find((s) => s.sequence === currentSequence);

  // Same real-progress logic as TripDetail.jsx - drives GeoMap's animated
  // vehicle marker from the coordinator's actual current_stop_sequence,
  // not a fake timer.
  const routeProgress =
    currentSequence != null && trip.bus_stops.length > 1
      ? currentSequence / (trip.bus_stops.length - 1)
      : null;
  const hasCoordinates = trip.origin_lat != null || trip.destination_lat != null;

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-1">
        <h2 className="font-heading font-semibold text-gray-900">Live vehicle tracker</h2>
        <span className="text-[10px] uppercase tracking-wide text-gray-400 font-semibold">Live</span>
      </div>
      <p role="status" aria-live="polite" className="text-sm text-primary-700 font-medium mb-4">
        {currentStop ? `Currently at: ${currentStop.name}` : "Not yet departed"}
      </p>

      {hasCoordinates && (
        <div className="mb-4 relative">
          <GeoMap
            originLat={trip.origin_lat}
            originLng={trip.origin_lng}
            destinationLat={trip.destination_lat}
            destinationLng={trip.destination_lng}
            originName={trip.origin}
            destinationName={trip.destination}
            progress={routeProgress}
          />
          <button
            type="button"
            onClick={() => setZoomed(true)}
            aria-label="Open live tracker in a bigger view"
            title="Zoom in"
            className="absolute top-2 right-2 z-[400] min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg bg-white/90 backdrop-blur text-gray-700 shadow-md hover:bg-white hover:text-primary-700 transition"
          >
            <ArrowsPointingOutIcon className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
      )}

      <StopList stops={trip.bus_stops} currentSequence={currentSequence} reduceMotion={reduceMotion} />

      {hasCoordinates && (
        <Modal open={zoomed} onClose={() => setZoomed(false)} title="Live vehicle tracker">
          <p role="status" aria-live="polite" className="text-sm text-primary-700 font-medium mb-4">
            {currentStop ? `Currently at: ${currentStop.name}` : "Not yet departed"}
          </p>
          <GeoMap
            originLat={trip.origin_lat}
            originLng={trip.origin_lng}
            destinationLat={trip.destination_lat}
            destinationLng={trip.destination_lng}
            originName={trip.origin}
            destinationName={trip.destination}
            progress={routeProgress}
            heightClassName="h-[60vh]"
            zoomable
          />
          <div className="mt-4">
            <StopList stops={trip.bus_stops} currentSequence={currentSequence} reduceMotion={reduceMotion} />
          </div>
        </Modal>
      )}
    </div>
  );
}
