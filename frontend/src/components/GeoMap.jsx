import { useEffect, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

// Bundled marker assets instead of hotlinking to unpkg.com - works offline,
// no external network dependency for a demo. Fixes leaflet's default icon
// path assumptions, which don't hold up under Vite's bundling.
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

// Heroicons TruckIcon paths, inlined as raw markup - react-leaflet markers
// need an L.DivIcon's HTML string, not a React component.
const TRUCK_SVG = `
  <div style="width:28px;height:28px;border-radius:9999px;background:#4f46e5;
    box-shadow:0 2px 6px rgba(0,0,0,0.35);display:flex;align-items:center;
    justify-content:center;border:2px solid white;">
    <svg viewBox="0 0 24 24" fill="white" width="16" height="16">
      <path d="M3.375 4.5C2.339 4.5 1.5 5.34 1.5 6.375V13.5h12V6.375c0-1.036-.84-1.875-1.875-1.875h-8.25ZM13.5 15h-12v2.625c0 1.035.84 1.875 1.875 1.875h.375a3 3 0 1 1 6 0h3a.75.75 0 0 0 .75-.75V15Z" />
      <path d="M8.25 19.5a1.5 1.5 0 1 0-3 0 1.5 1.5 0 0 0 3 0ZM15.75 6.75a.75.75 0 0 0-.75.75v11.25c0 .087.015.17.042.248a3 3 0 0 1 5.958.464c.853-.175 1.522-.935 1.464-1.883a18.659 18.659 0 0 0-3.732-10.104 1.837 1.837 0 0 0-1.47-.725H15.75Z" />
      <path d="M19.5 19.5a1.5 1.5 0 1 0-3 0 1.5 1.5 0 0 0 3 0Z" />
    </svg>
  </div>
`;

const VEHICLE_ICON = L.divIcon({
  html: TRUCK_SVG,
  className: "",
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

// Eases the marker from its last position to the new one over ~1.4s
// whenever `target` changes, instead of jumping - this is what makes the
// vehicle read as "moving" rather than teleporting each time the
// coordinator advances current_stop_sequence (SAHYOG-46) or the 5s poll
// picks up a change. Skipped entirely under reduced motion.
function useAnimatedProgress(target, reduceMotion) {
  const [value, setValue] = useState(target ?? 0);
  const fromRef = useRef(target ?? 0);
  const rafRef = useRef(null);

  useEffect(() => {
    if (target == null) return;
    if (reduceMotion) {
      setValue(target);
      fromRef.current = target;
      return;
    }
    const from = fromRef.current;
    const to = target;
    if (from === to) return;

    const duration = 1400;
    const start = performance.now();

    function tick(now) {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      const current = from + (to - from) * eased;
      setValue(current);
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = to;
      }
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => rafRef.current && cancelAnimationFrame(rafRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, reduceMotion]);

  return value;
}

function VehicleMarker({ origin, destination, progress }) {
  const reduceMotion = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const animated = useAnimatedProgress(progress, reduceMotion);

  if (progress == null || !origin || !destination) return null;

  const lat = origin[0] + (destination[0] - origin[0]) * animated;
  const lng = origin[1] + (destination[1] - origin[1]) * animated;

  return (
    <Marker position={[lat, lng]} icon={VEHICLE_ICON} zIndexOffset={1000}>
      <Popup>Vehicle - currently en route</Popup>
    </Marker>
  );
}

function MapBounds({ origin, destination }) {
  const map = useMap();
  useEffect(() => {
    if (origin && destination) {
      const bounds = L.latLngBounds([origin, destination]);
      map.fitBounds(bounds, { padding: [50, 50] });
    } else if (origin) {
      map.setView(origin, 13);
    } else if (destination) {
      map.setView(destination, 13);
    }
  }, [map, origin, destination]);
  return null;
}

// Purely a display layer over plain lat/lng numbers the coordinator/rider
// already typed or geocoded client-side (CreateTrip.jsx) - the backend
// never computes or validates anything map-related, it just stores and
// returns four nullable floats (SAHYOG-47).
//
// `progress` (0-1, or null/undefined) drives the animated vehicle marker -
// it's not a fake timer, it's derived from the coordinator's real
// current_stop_sequence (SAHYOG-46), same "no invented data" principle
// that replaced the old purely-simulated VehicleTracker.jsx. Omit it (or
// pass null) to show just the static route with no vehicle, e.g. the
// CreateTrip preview where there's no live tracking data yet.
export default function GeoMap({
  originLat,
  originLng,
  destinationLat,
  destinationLng,
  originName,
  destinationName,
  progress = null,
  heightClassName = "h-[300px]",
  zoomable = false,
}) {
  const hasOrigin = originLat != null && originLng != null;
  const hasDestination = destinationLat != null && destinationLng != null;

  if (!hasOrigin && !hasDestination) {
    return null;
  }

  const origin = hasOrigin ? [originLat, originLng] : null;
  const destination = hasDestination ? [destinationLat, destinationLng] : null;
  const center = origin || destination || [0, 0];
  const showVehicle = progress != null && origin && destination;

  return (
    <div className={`${heightClassName} w-full rounded-xl overflow-hidden shadow-inner border border-gray-200 z-0 relative`}>
      <MapContainer
        center={center}
        zoom={13}
        style={{ height: "100%", width: "100%" }}
        scrollWheelZoom={zoomable}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {origin && (
          <Marker position={origin}>
            <Popup>
              <strong>Origin:</strong> {originName || "Start Location"}
            </Popup>
          </Marker>
        )}
        {destination && (
          <Marker position={destination}>
            <Popup>
              <strong>Destination:</strong> {destinationName || "End Location"}
            </Popup>
          </Marker>
        )}
        {origin && destination && (
          <Polyline positions={[origin, destination]} color="#6366f1" weight={4} dashArray="5, 10" />
        )}
        {showVehicle && <VehicleMarker origin={origin} destination={destination} progress={progress} />}
        <MapBounds origin={origin} destination={destination} />
      </MapContainer>
    </div>
  );
}
