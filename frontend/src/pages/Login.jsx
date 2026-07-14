import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { EnvelopeIcon, LockClosedIcon } from "@heroicons/react/24/outline";

import { useAuth } from "../context/AuthContext";
import BackgroundBlobs from "../components/BackgroundBlobs";
import ErrorState from "../components/states/ErrorState";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();
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

  const container = {
    hidden: {},
    show: { transition: { staggerChildren: reduceMotion ? 0 : 0.1, delayChildren: 0.05 } },
  };
  const item = reduceMotion
    ? { hidden: { opacity: 1 }, show: { opacity: 1 } }
    : {
        hidden: { opacity: 0, y: 14 },
        show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } },
      };

  return (
    <div className="min-h-screen relative flex items-center justify-center px-4 py-10">
      <BackgroundBlobs />

      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="w-full max-w-sm"
      >
        <Link to="/" className="brand-wordmark text-xl block text-center mb-6">
          SahyogRide
        </Link>

        <motion.form
          variants={container}
          initial="hidden"
          animate="show"
          onSubmit={handleSubmit}
          className="card p-6 space-y-4"
        >
          <motion.div variants={item} className="flex flex-col items-center text-center gap-2 mb-2">
            <motion.span
              whileHover={reduceMotion ? {} : { scale: 1.08, rotate: -4 }}
              transition={{ type: "spring", stiffness: 300, damping: 15 }}
              className="icon-badge bg-gradient-to-br from-primary-500 to-primary-700"
            >
              <LockClosedIcon className="w-6 h-6 relative" aria-hidden="true" />
            </motion.span>
            <h1 className="font-heading text-2xl font-bold text-gray-900">Welcome back</h1>
          </motion.div>

          {error && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <ErrorState message={error} />
            </motion.div>
          )}

          <motion.div variants={item}>
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
          </motion.div>

          <motion.div variants={item}>
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
          </motion.div>

          <motion.div variants={item}>
            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? "Logging in…" : "Log in"}
            </button>
          </motion.div>

          <motion.p variants={item} className="text-sm text-center text-gray-600">
            Don't have an account?{" "}
            <Link to="/register" className="text-primary-600 font-medium hover:underline">
              Register
            </Link>
          </motion.p>
        </motion.form>
      </motion.div>
    </div>
  );
}
