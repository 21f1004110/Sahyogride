import client from "./client";

export async function confirmReservation(holdId) {
  const res = await client.post("/reservations", { hold_id: holdId });
  return res.data;
}

export async function cancelReservation(reservationId) {
  const res = await client.post(`/reservations/${reservationId}/cancel`);
  return res.data;
}

export async function getMyReservations() {
  const res = await client.get("/reservations/me");
  return res.data;
}
