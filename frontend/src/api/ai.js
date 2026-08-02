import client from "./client";

export async function aiSearch(query) {
  const res = await client.post("/ai/search", { query });
  return res.data;
}

export async function recommendSeat(tripId, note) {
  const res = await client.post(`/trips/${tripId}/seat-recommendation`, { note });
  return res.data;
}
