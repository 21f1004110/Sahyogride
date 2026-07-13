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

// searchTrips()/getTrip() land here starting SAHYOG-06/07.
