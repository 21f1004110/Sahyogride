import client from "./client";

export async function holdSeat(seatId) {
  const res = await client.post("/holds", { seat_id: seatId });
  return res.data;
}

export async function releaseHold(holdId) {
  await client.delete(`/holds/${holdId}`);
}
