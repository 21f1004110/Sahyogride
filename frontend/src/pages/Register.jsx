import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { EnvelopeIcon, LockClosedIcon, UserIcon, UserPlusIcon } from "@heroicons/react/24/outline";

import { useAuth } from "../context/AuthContext";
import BackgroundBlobs from "../components/BackgroundBlobs";
import ErrorState from "../components/states/ErrorState";

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("rider");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await register({ name, email, password, role });
      navigate("/");
    } catch (err) {
      setError(err.response?.data?.error?.message || "Registration failed. Please try again.");
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
            <span className="w-12 h-12 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center">
              <UserPlusIcon className="w-6 h-6" aria-hidden="true" />
            </span>
            <h1 className="font-heading text-2xl font-bold text-gray-900">Create an account</h1>
          </div>

          {error && <ErrorState message={error} />}

          <div>
            <label htmlFor="name" className="field-label">
              Name
            </label>
            <div className="input-icon-wrap">
              <UserIcon className="input-icon" aria-hidden="true" />
              <input
                id="name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="input-field !mt-0 pl-10"
              />
            </div>
          </div>

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

          <fieldset>
            <legend className="field-label">I am a</legend>
            <div className="mt-2 flex gap-3">
              <label
                className={`flex-1 flex items-center justify-center gap-2 min-h-[44px] rounded-xl border px-3 cursor-pointer focus-within:ring-2 focus-within:ring-primary-500 ${
                  role === "rider"
                    ? "border-primary-500 bg-primary-50 text-primary-700"
                    : "border-gray-300 text-gray-600"
                }`}
              >
                <input
                  type="radio"
                  name="role"
                  value="rider"
                  checked={role === "rider"}
                  onChange={() => setRole("rider")}
                  className="sr-only"
                />
                Rider
              </label>
              <label
                className={`flex-1 flex items-center justify-center gap-2 min-h-[44px] rounded-xl border px-3 cursor-pointer focus-within:ring-2 focus-within:ring-primary-500 ${
                  role === "coordinator"
                    ? "border-primary-500 bg-primary-50 text-primary-700"
                    : "border-gray-300 text-gray-600"
                }`}
              >
                <input
                  type="radio"
                  name="role"
                  value="coordinator"
                  checked={role === "coordinator"}
                  onChange={() => setRole("coordinator")}
                  className="sr-only"
                />
                Coordinator
              </label>
            </div>
          </fieldset>

          <button type="submit" disabled={loading} className="btn-primary w-full">
            {loading ? "Creating account…" : "Register"}
          </button>

          <p className="text-sm text-center text-gray-600">
            Already have an account?{" "}
            <Link to="/login" className="text-primary-600 font-medium hover:underline">
              Log in
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
