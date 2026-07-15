import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRightIcon, MagnifyingGlassIcon, PlusCircleIcon } from "@heroicons/react/24/outline";

import { useAuth } from "../context/AuthContext";

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
};

export default function Dashboard() {
  const { user } = useAuth();
  const reduceMotion = useReducedMotion();
  const item = reduceMotion
    ? { hidden: { opacity: 1 }, show: { opacity: 1 } }
    : {
        hidden: { opacity: 0, y: 16 },
        show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } },
      };

  const firstName = user.name.split(" ")[0];

  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <motion.div
        initial={reduceMotion ? false : "hidden"}
        animate="show"
        variants={container}
      >
        <motion.div variants={item}>
          <p className="text-sm font-medium text-primary-600 mb-1">
            {new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}
          </p>
          <h1 className="font-heading text-3xl sm:text-4xl font-bold text-gray-900">
            Welcome back, {firstName}
          </h1>
          <p className="mt-2 text-gray-600">
            You're signed in as a{" "}
            <span className="badge-purple align-middle">{user.role}</span>
          </p>
        </motion.div>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <motion.div variants={item}>
            <Link
              to="/trips"
              className="card group p-6 h-full flex flex-col hover:shadow-lg hover:-translate-y-0.5 hover:border-primary-200 transition"
            >
              <span className="icon-badge bg-gradient-to-br from-primary-500 to-primary-700 mb-4">
                <MagnifyingGlassIcon className="w-6 h-6 relative" aria-hidden="true" />
              </span>
              <h2 className="font-heading font-semibold text-gray-900 mb-1">Search trips</h2>
              <p className="text-sm text-gray-600 flex-1">
                Find a free shuttle trip and hold a seat.
              </p>
              <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary-600 group-hover:gap-2 transition-all">
                Browse trips
                <ArrowRightIcon className="w-4 h-4" aria-hidden="true" />
              </span>
            </Link>
          </motion.div>

          {user.role === "coordinator" && (
            <motion.div variants={item}>
              <Link
                to="/trips/new"
                className="card group p-6 h-full flex flex-col hover:shadow-lg hover:-translate-y-0.5 hover:border-brand-200 transition"
              >
                <span className="icon-badge bg-gradient-to-br from-brand-500 to-brand-700 mb-4">
                  <PlusCircleIcon className="w-6 h-6 relative" aria-hidden="true" />
                </span>
                <h2 className="font-heading font-semibold text-gray-900 mb-1">Create a trip</h2>
                <p className="text-sm text-gray-600 flex-1">
                  Publish a new free shuttle trip with open seats.
                </p>
                <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-brand-600 group-hover:gap-2 transition-all">
                  New trip
                  <ArrowRightIcon className="w-4 h-4" aria-hidden="true" />
                </span>
              </Link>
            </motion.div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
