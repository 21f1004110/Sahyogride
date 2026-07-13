import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { useAuth } from "../context/AuthContext";
import ErrorState from "../components/states/ErrorState";
import Loading from "../components/states/Loading";

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
    <div className="min-h-screen flex items-center justify-center px-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
        <h1 className="text-2xl font-semibold">Create an account</h1>

        {error && <ErrorState message={error} />}

        <div>
          <label htmlFor="name" className="block text-sm font-medium">
            Name
          </label>
          <input
            id="name"
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 block w-full min-h-[44px] rounded border border-gray-300 px-3"
          />
        </div>

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

        <fieldset>
          <legend className="block text-sm font-medium">I am a</legend>
          <div className="mt-1 flex gap-4">
            <label className="flex items-center gap-2 min-h-[44px]">
              <input
                type="radio"
                name="role"
                value="rider"
                checked={role === "rider"}
                onChange={() => setRole("rider")}
              />
              Rider
            </label>
            <label className="flex items-center gap-2 min-h-[44px]">
              <input
                type="radio"
                name="role"
                value="coordinator"
                checked={role === "coordinator"}
                onChange={() => setRole("coordinator")}
              />
              Coordinator
            </label>
          </div>
        </fieldset>

        <button
          type="submit"
          disabled={loading}
          className="w-full min-h-[44px] rounded bg-blue-600 text-white font-medium disabled:opacity-50"
        >
          {loading ? <Loading /> : "Register"}
        </button>

        <p className="text-sm text-center">
          Already have an account? <Link to="/login" className="underline">Log in</Link>
        </p>
      </form>
    </div>
  );
}
