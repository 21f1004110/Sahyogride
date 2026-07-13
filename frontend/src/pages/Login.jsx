import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { EnvelopeIcon, LockClosedIcon } from "@heroicons/react/24/outline";

import { useAuth } from "../context/AuthContext";
import BackgroundBlobs from "../components/BackgroundBlobs";
import ErrorState from "../components/states/ErrorState";

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
    <div className="min-h-screen relative flex items-center justify-center px-4 py-10">
      <BackgroundBlobs />

      <div className="w-full max-w-sm">
        <Link to="/" className="brand-wordmark text-xl block text-center mb-6">
          SahyogRide
        </Link>

        <form onSubmit={handleSubmit} className="card p-6 space-y-4">
          <div className="flex flex-col items-center text-center gap-2 mb-2">
            <span className="w-12 h-12 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center">
              <LockClosedIcon className="w-6 h-6" aria-hidden="true" />
            </span>
            <h1 className="font-heading text-2xl font-bold text-gray-900">Welcome back</h1>
          </div>

          {error && <ErrorState message={error} />}

          <div>
            <label htmlFor="email" className="field-label">
              Email
            </label>
            <div className="input-icon-wrap">
              <EnvelopeIcon className="input-icon" aria-hidden="true" />
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-field !mt-0 pl-10"
              />
            </div>
          </div>

          <div>
            <label htmlFor="password" className="field-label">
              Password
            </label>
            <div className="input-icon-wrap">
              <LockClosedIcon className="input-icon" aria-hidden="true" />
              <input
                id="password"
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-field !mt-0 pl-10"
              />
            </div>
          </div>

          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? "Logging in…" : "Log in"}
          </button>

          <p className="text-sm text-center text-gray-600">
            Don't have an account?{" "}
            <Link to="/register" className="text-primary-600 font-medium hover:underline">
              Register
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
