import client from "./client";

export async function register({ name, email, password, role }) {
  const res = await client.post("/auth/register", { name, email, password, role });
  return res.data;
}

export async function login({ email, password }) {
  const res = await client.post("/auth/login", { email, password });
  return res.data;
}
