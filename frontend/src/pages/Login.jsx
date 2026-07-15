import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { EnvelopeIcon, EyeIcon, EyeSlashIcon, LockClosedIcon } from "@heroicons/react/24/outline";

import { useAuth } from "../context/AuthContext";
import AuthLayout from "../components/AuthLayout";
import ErrorState from "../components/states/ErrorState";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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
    <AuthLayout
      panelTitle="Free rides for the trips that matter most"
      panelBody="NGOs and hospitals publish free shuttle trips for essential travel — medical visits, exams, work. Log in to find your seat."
    >
      <motion.div
        initial={reduceMotion ? false : { opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      >
        <motion.form
          variants={container}
          initial="hidden"
          animate="show"
          onSubmit={handleSubmit}
          className="glass-card p-8 space-y-5"
        >
          <motion.div variants={item} className="flex flex-col items-center text-center gap-3 mb-2">
            <motion.span
              whileHover={reduceMotion ? {} : { scale: 1.08, rotate: -4 }}
              transition={{ type: "spring", stiffness: 300, damping: 15 }}
              className="icon-badge bg-gradient-to-br from-primary-500 to-primary-700"
            >
              <LockClosedIcon className="w-6 h-6 relative" aria-hidden="true" />
            </motion.span>
            <div>
              <h1 className="font-heading text-2xl font-bold text-gray-900">Welcome back</h1>
              <p className="text-sm text-gray-500 mt-1">Log in to search and hold your seat.</p>
            </div>
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
                type={showPassword ? "text" : "password"}
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-field !mt-0 pl-10 pr-11"
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
              >
                {showPassword ? (
                  <EyeSlashIcon className="w-5 h-5" aria-hidden="true" />
                ) : (
                  <EyeIcon className="w-5 h-5" aria-hidden="true" />
                )}
              </button>
            </div>
          </motion.div>

          <motion.div variants={item}>
            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? "Logging in…" : "Log in"}
            </button>
          </motion.div>

          <motion.p variants={item} className="text-sm text-center text-gray-600">
            Don't have an account?{" "}
            <Link to="/register" className="text-primary-600 font-semibold hover:underline">
              Register
            </Link>
          </motion.p>
        </motion.form>
      </motion.div>
    </AuthLayout>
  );
}
