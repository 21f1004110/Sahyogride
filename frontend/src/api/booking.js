import client from "./client";

export async function confirmReservation(holdId) {
  const res = await client.post("/reservations", { hold_id: holdId });
  return res.data;
}
