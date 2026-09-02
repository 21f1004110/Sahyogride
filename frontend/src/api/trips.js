import client from "./client";

export async function createTrip({
  origin,
  destination,
  departure_time,
  total_seats,
  purpose,
  origin_lat,
  origin_lng,
  destination_lat,
  destination_lng,
}) {
  const res = await client.post("/trips", {
    origin,
    destination,
    departure_time,
    total_seats,
    purpose: purpose || null,
    origin_lat: origin_lat ?? null,
    origin_lng: origin_lng ?? null,
    destination_lat: destination_lat ?? null,
    destination_lng: destination_lng ?? null,
  });
  return res.data;
}

export async function draftTrip(description) {
  const res = await client.post("/trips/draft", { description });
  return res.data;
}

export async function searchTrips({ origin, destination, date, q } = {}) {
  const params = {};
  if (origin) params.origin = origin;
  if (destination) params.destination = destination;
  if (date) params.date = date;
  if (q) params.q = q;

  const res = await client.get("/trips", { params });
  return res.data;
}

export async function getTrip(id) {
  const res = await client.get(`/trips/${id}`);
  return res.data;
}

export async function getMyTrips() {
  const res = await client.get("/trips/mine");
  return res.data;
}

export async function getTripPassengers(id) {
  const res = await client.get(`/trips/${id}/passengers`);
  return res.data;
}

export async function getSimilarTrips(id, limit = 3) {
  const res = await client.get(`/trips/${id}/similar`, { params: { limit } });
  return res.data;
}

export async function setBusStops(tripId, stopNames) {
  const res = await client.put(`/trips/${tripId}/stops`, { stop_names: stopNames });
  return res.data;
}

export async function setCurrentStop(tripId, sequence) {
  const res = await client.patch(`/trips/${tripId}/stops/current`, { sequence });
  return res.data;
}
