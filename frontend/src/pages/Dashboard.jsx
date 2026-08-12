import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowRightIcon,
  CalendarDaysIcon,
  ClockIcon,
  FireIcon,
  MagnifyingGlassIcon,
  PlusCircleIcon,
  TicketIcon,
  UserGroupIcon,
  UsersIcon,
} from "@heroicons/react/24/outline";

import { useAuth } from "../context/AuthContext";
import { getMyReservations } from "../api/booking";
import { getMyTrips } from "../api/trips";
import AnimatedNumber from "../components/AnimatedNumber";

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
};

function StatCard({ icon: Icon, gradient, value, label }) {
  return (
    <div className="card p-4 flex items-center gap-3">
      <span className={`icon-badge w-11 h-11 bg-gradient-to-br ${gradient} shrink-0`}>
        <Icon className="w-5 h-5 relative" aria-hidden="true" />
      </span>
      <div>
        <p className="font-heading text-2xl font-bold text-gray-900 leading-none">
          <AnimatedNumber value={value} />
        </p>
        <p className="text-xs text-gray-500 mt-0.5">{label}</p>
      </div>
    </div>
  );
}

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

  const { data: reservationsData } = useQuery({
    queryKey: ["my-reservations"],
    queryFn: getMyReservations,
    enabled: user.role === "rider",
  });

  const { data: tripsData } = useQuery({
    queryKey: ["my-trips"],
    queryFn: getMyTrips,
    enabled: user.role === "coordinator",
  });

  const reservations = reservationsData?.reservations ?? [];
  const upcomingReservations = reservations.filter((r) => r.status === "confirmed");
  const nextReservation = upcomingReservations
    .slice()
    .sort((a, b) => new Date(a.departure_time) - new Date(b.departure_time))[0];

  const trips = tripsData?.trips ?? [];
  const totalSeats = trips.reduce((sum, t) => sum + t.total_seats, 0);
  const seatsFilled = trips.reduce((sum, t) => sum + (t.total_seats - t.seats_available), 0);
  const highDemandCount = trips.filter((t) => t.ai_high_demand).length;

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

        {user.role === "rider" && nextReservation && (
          <motion.div
            variants={item}
            className="mt-6 card p-5 flex items-center gap-4 border-primary-200 ring-1 ring-primary-100"
          >
            <span className="icon-badge bg-gradient-to-br from-primary-500 to-primary-700 shrink-0">
              <ClockIcon className="w-6 h-6 relative" aria-hidden="true" />
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-primary-600 uppercase tracking-wide">
                Your next ride
              </p>
              <p className="font-heading font-semibold text-gray-900 truncate">
                {nextReservation.trip_origin} &rarr; {nextReservation.trip_destination}
              </p>
              <p className="text-sm text-gray-500 flex items-center gap-1.5 mt-0.5">
                <CalendarDaysIcon className="w-4 h-4 shrink-0" aria-hidden="true" />
                {new Date(nextReservation.departure_time).toLocaleString()}
              </p>
            </div>
            <Link
              to="/reservations"
              className="btn-secondary shrink-0 hidden sm:inline-flex"
            >
              View
            </Link>
          </motion.div>
        )}

        {user.role === "rider" && upcomingReservations.length > 0 && (
          <motion.div variants={item} className="mt-6 grid gap-3 grid-cols-2">
            <StatCard
              icon={TicketIcon}
              gradient="from-primary-500 to-primary-700"
              value={upcomingReservations.length}
              label={upcomingReservations.length === 1 ? "Upcoming reservation" : "Upcoming reservations"}
            />
            <StatCard
              icon={CalendarDaysIcon}
              gradient="from-brand-500 to-brand-700"
              value={reservations.filter((r) => r.status === "cancelled").length}
              label="Cancelled reservations"
            />
          </motion.div>
        )}

        {user.role === "coordinator" && trips.length > 0 && (
          <motion.div variants={item} className="mt-6 grid gap-3 grid-cols-3">
            <StatCard
              icon={UserGroupIcon}
              gradient="from-primary-500 to-primary-700"
              value={trips.length}
              label={trips.length === 1 ? "Trip published" : "Trips published"}
            />
            <StatCard
              icon={UsersIcon}
              gradient="from-brand-500 to-brand-700"
              value={seatsFilled}
              label={`of ${totalSeats} seats filled`}
            />
            <StatCard
              icon={FireIcon}
              gradient="from-amber-500 to-amber-700"
              value={highDemandCount}
              label="High-demand trips"
            />
          </motion.div>
        )}

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

          {user.role === "rider" && (
            <motion.div variants={item}>
              <Link
                to="/reservations"
                className="card group p-6 h-full flex flex-col hover:shadow-lg hover:-translate-y-0.5 hover:border-brand-200 transition"
              >
                <span className="icon-badge bg-gradient-to-br from-brand-500 to-brand-700 mb-4">
                  <TicketIcon className="w-6 h-6 relative" aria-hidden="true" />
                </span>
                <h2 className="font-heading font-semibold text-gray-900 mb-1">My reservations</h2>
                <p className="text-sm text-gray-600 flex-1">
                  Track upcoming rides, live vehicle status, and cancel if plans change.
                </p>
                <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-brand-600 group-hover:gap-2 transition-all">
                  View reservations
                  <ArrowRightIcon className="w-4 h-4" aria-hidden="true" />
                </span>
              </Link>
            </motion.div>
          )}

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

          {user.role === "coordinator" && (
            <motion.div variants={item}>
              <Link
                to="/my-trips"
                className="card group p-6 h-full flex flex-col hover:shadow-lg hover:-translate-y-0.5 hover:border-primary-200 transition"
              >
                <span className="icon-badge bg-gradient-to-br from-primary-500 to-primary-700 mb-4">
                  <UserGroupIcon className="w-6 h-6 relative" aria-hidden="true" />
                </span>
                <h2 className="font-heading font-semibold text-gray-900 mb-1">My trips</h2>
                <p className="text-sm text-gray-600 flex-1">
                  View your published trips and their passenger lists.
                </p>
                <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary-600 group-hover:gap-2 transition-all">
                  View trips
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
