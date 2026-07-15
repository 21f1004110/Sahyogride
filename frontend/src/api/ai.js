import client from "./client";

export async function aiSearch(query) {
  const res = await client.post("/ai/search", { query });
  return res.data;
}
