import client from "./client";

export async function createTrip({ origin, destination, departure_time, total_seats, purpose }) {
  const res = await client.post("/trips", {
    origin,
    destination,
    departure_time,
    total_seats,
    purpose: purpose || null,
  });
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

// getTrip() lands here starting SAHYOG-07.
