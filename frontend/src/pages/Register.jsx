import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import {
  EnvelopeIcon,
  EyeIcon,
  EyeSlashIcon,
  LockClosedIcon,
  UserIcon,
  UserPlusIcon,
} from "@heroicons/react/24/outline";

import { useAuth } from "../context/AuthContext";
import AuthLayout from "../components/AuthLayout";
import ErrorState from "../components/states/ErrorState";

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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

  const container = {
    hidden: {},
    show: { transition: { staggerChildren: reduceMotion ? 0 : 0.08, delayChildren: 0.05 } },
  };
  const item = reduceMotion
    ? { hidden: { opacity: 1 }, show: { opacity: 1 } }
    : {
        hidden: { opacity: 0, y: 14 },
        show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } },
      };

  return (
    <AuthLayout
      panelTitle="Fair, first-come seats for the people who need them"
      panelBody="Create an account to search free shuttle trips near you, or publish trips for riders who need a seat."
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
              whileHover={reduceMotion ? {} : { scale: 1.08, rotate: 4 }}
              transition={{ type: "spring", stiffness: 300, damping: 15 }}
              className="icon-badge bg-gradient-to-br from-brand-500 to-brand-700"
            >
              <UserPlusIcon className="w-6 h-6 relative" aria-hidden="true" />
            </motion.span>
            <div>
              <h1 className="font-heading text-2xl font-bold text-gray-900">Create an account</h1>
              <p className="text-sm text-gray-500 mt-1">Free, always. No payment details, ever.</p>
            </div>
          </motion.div>

          {error && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <ErrorState message={error} />
            </motion.div>
          )}

          <motion.div variants={item}>
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
          </motion.div>

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

          <motion.fieldset variants={item}>
            <legend className="field-label">I am a</legend>
            <div className="mt-2 flex gap-3">
              {["rider", "coordinator"].map((option) => (
                <label
                  key={option}
                  className={`relative flex-1 flex items-center justify-center gap-2 min-h-[44px] rounded-xl border px-3 cursor-pointer overflow-hidden focus-within:ring-2 focus-within:ring-primary-500 ${
                    role === option ? "border-primary-500 text-primary-700" : "border-gray-300 text-gray-600"
                  }`}
                >
                  {role === option && (
                    <motion.span
                      layoutId="role-highlight"
                      transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 400, damping: 30 }}
                      className="absolute inset-0 bg-primary-50"
                    />
                  )}
                  <input
                    type="radio"
                    name="role"
                    value={option}
                    checked={role === option}
                    onChange={() => setRole(option)}
                    className="sr-only"
                  />
                  <span className="relative capitalize">{option}</span>
                </label>
              ))}
            </div>
          </motion.fieldset>

          <motion.div variants={item}>
            <button type="submit" disabled={loading} className="btn-primary w-full">
              {loading ? "Creating account…" : "Register"}
            </button>
          </motion.div>

          <motion.p variants={item} className="text-sm text-center text-gray-600">
            Already have an account?{" "}
            <Link to="/login" className="text-primary-600 font-semibold hover:underline">
              Log in
            </Link>
          </motion.p>
        </motion.form>
      </motion.div>
    </AuthLayout>
  );
}
