import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { CheckCircleIcon, ClockIcon, MagnifyingGlassIcon } from "@heroicons/react/24/outline";

import BackgroundBlobs from "../components/BackgroundBlobs";
import HeroIllustration from "../components/HeroIllustration";

const STEPS = [
  {
    title: "Search",
    body: "Find a free shuttle trip posted by an NGO or hospital near you — for medical visits, exams, or work.",
    Icon: MagnifyingGlassIcon,
  },
  {
    title: "Hold your seat",
    body: "Tap an open seat to hold it for a few minutes while you confirm your ride.",
    Icon: ClockIcon,
  },
  {
    title: "Confirm & go",
    body: "Confirm your reservation and you're set. Change your mind? Cancel anytime and free the seat for someone else.",
    Icon: CheckCircleIcon,
  },
];

const TRUST_BADGES = ["100% free, always", "No payments, ever", "Fair, first-come seating"];

export default function Landing() {
  const reduceMotion = useReducedMotion();

  const heroContainer = {
    hidden: {},
    show: { transition: { staggerChildren: reduceMotion ? 0 : 0.12, delayChildren: 0.05 } },
  };
  const heroItem = reduceMotion
    ? { hidden: { opacity: 1 }, show: { opacity: 1 } }
    : {
        hidden: { opacity: 0, y: 18 },
        show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } },
      };

  return (
    <div className="min-h-screen relative overflow-hidden">
      <BackgroundBlobs />

      <motion.header
        initial={reduceMotion ? false : { opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between"
      >
        <span className="brand-wordmark text-xl">SahyogRide</span>
        <div className="flex items-center gap-2">
          <Link to="/login" className="btn-secondary">
            Log in
          </Link>
          <Link to="/register" className="btn-primary">
            Get started
          </Link>
        </div>
      </motion.header>

      <section className="max-w-5xl mx-auto px-4 pt-8 pb-20 grid items-center gap-10 sm:grid-cols-2">
        <motion.div
          variants={heroContainer}
          initial="hidden"
          animate="show"
          className="text-center sm:text-left"
        >
          <motion.h1
            variants={heroItem}
            className="font-heading text-4xl sm:text-5xl font-extrabold text-gray-900 leading-tight"
          >
            Free rides for the trips that
            <span className="brand-wordmark"> matter most</span>
          </motion.h1>
          <motion.p variants={heroItem} className="mt-5 text-lg text-gray-600 max-w-xl mx-auto sm:mx-0">
            NGOs and hospitals publish free shuttle trips for essential travel — medical visits,
            exams, work. SahyogRide helps people in need find a seat, fairly and without a single
            seat ever double-booked.
          </motion.p>
          <motion.div
            variants={heroItem}
            className="mt-8 flex flex-wrap items-center justify-center sm:justify-start gap-3"
          >
            <Link to="/register" className="btn-primary">
              Find a ride
            </Link>
            <Link to="/login" className="btn-secondary">
              I already have an account
            </Link>
          </motion.div>

          <motion.ul
            variants={heroItem}
            className="mt-8 flex flex-wrap justify-center sm:justify-start gap-2"
          >
            {TRUST_BADGES.map((badge) => (
              <li
                key={badge}
                className="text-xs font-medium text-primary-700 bg-primary-50 border border-primary-100 rounded-full px-3 py-1"
              >
                {badge}
              </li>
            ))}
          </motion.ul>
        </motion.div>

        <motion.div
          initial={reduceMotion ? false : { opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.15, ease: "easeOut" }}
          className="hidden sm:block"
        >
          <HeroIllustration />
        </motion.div>
      </section>

      <section className="max-w-5xl mx-auto px-4 pb-24">
        <h2 className="font-heading text-2xl font-bold text-gray-900 text-center mb-10">
          How it works
        </h2>
        <div className="grid gap-6 sm:grid-cols-3">
          {STEPS.map((step, i) => (
            <motion.div
              key={step.title}
              initial={reduceMotion ? false : { opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.4 }}
              transition={{ duration: 0.5, delay: reduceMotion ? 0 : i * 0.12, ease: "easeOut" }}
              whileHover={reduceMotion ? {} : { y: -4 }}
              className="card p-6"
            >
              <motion.div
                whileHover={reduceMotion ? {} : { scale: 1.1, rotate: 4 }}
                transition={{ type: "spring", stiffness: 300, damping: 15 }}
                className="w-11 h-11 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center mb-4"
              >
                <step.Icon className="w-6 h-6" aria-hidden="true" />
              </motion.div>
              <h3 className="font-heading font-semibold text-gray-900 mb-1">{step.title}</h3>
              <p className="text-sm text-gray-600">{step.body}</p>
            </motion.div>
          ))}
        </div>
      </section>

      <footer className="max-w-5xl mx-auto px-4 pb-10 text-center text-sm text-gray-500">
        SahyogRide is a free, non-commercial community shuttle platform. No payments, ever.
      </footer>
    </div>
  );
}
