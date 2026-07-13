import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { useAuth } from "../context/AuthContext";
import ErrorState from "../components/states/ErrorState";
import Loading from "../components/states/Loading";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await login({ email, password });
      navigate("/");
    } catch (err) {
      setError(err.response?.data?.error?.message || "Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
        <h1 className="text-2xl font-semibold">Log in</h1>

        {error && <ErrorState message={error} />}

        <div>
          <label htmlFor="email" className="block text-sm font-medium">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 block w-full min-h-[44px] rounded border border-gray-300 px-3"
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium">
            Password
          </label>
          <input
            id="password"
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 block w-full min-h-[44px] rounded border border-gray-300 px-3"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full min-h-[44px] rounded bg-blue-600 text-white font-medium disabled:opacity-50"
        >
          {loading ? <Loading /> : "Log in"}
        </button>

        <p className="text-sm text-center">
          Don't have an account? <Link to="/register" className="underline">Register</Link>
        </p>
      </form>
    </div>
  );
}
