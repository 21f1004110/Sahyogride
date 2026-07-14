import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import {
  BuildingOffice2Icon,
  CheckCircleIcon,
  ChevronDownIcon,
  ClockIcon,
  GiftIcon,
  HandRaisedIcon,
  MagnifyingGlassIcon,
  ScaleIcon,
  ShieldCheckIcon,
  UserIcon,
  XCircleIcon,
} from "@heroicons/react/24/outline";

import Avatar from "../components/Avatar";
import BackgroundBlobs from "../components/BackgroundBlobs";
import Fireworks from "../components/Fireworks";
import HeroIllustration from "../components/HeroIllustration";
import Magnetic from "../components/Magnetic";
import SeatMap from "../components/SeatMap";

const STEPS = [
  {
    number: "01",
    title: "Search",
    body: "Find a free shuttle trip posted by an NGO or hospital near you — for medical visits, exams, or work.",
    Icon: MagnifyingGlassIcon,
    gradient: "from-primary-500 to-primary-700",
  },
  {
    number: "02",
    title: "Hold your seat",
    body: "Tap an open seat to hold it for a few minutes while you confirm your ride.",
    Icon: ClockIcon,
    gradient: "from-brand-500 to-brand-700",
  },
  {
    number: "03",
    title: "Confirm & go",
    body: "Confirm your reservation and you're set. Change your mind? Cancel anytime and free the seat for someone else.",
    Icon: CheckCircleIcon,
    gradient: "from-emerald-500 to-emerald-700",
  },
];

const TRUST_BADGES = ["100% free, always", "No payments, ever", "Fair, first-come seating"];

const FACTS = [
  { value: 0, prefix: "$", label: "Ever charged to a rider" },
  { value: 5, suffix: " min", label: "Max time a seat is held" },
  { value: 100, suffix: "%", label: "Fair, first-come seating" },
];

const AUDIENCES = [
  {
    title: "Riders",
    Icon: UserIcon,
    gradient: "from-brand-500 to-brand-700",
    body: "Anyone who needs a ride for something essential — a hospital appointment, an exam, a shift at work.",
    points: [
      "Search trips by origin, destination, date, or purpose",
      "Hold a seat instantly, no back-and-forth with anyone",
      "See exactly which seats are open before you pick one",
    ],
  },
  {
    title: "Coordinators",
    Icon: BuildingOffice2Icon,
    gradient: "from-primary-500 to-primary-700",
    body: "NGOs, hospitals, and community organizations that run the shuttles riders depend on.",
    points: [
      "Publish a trip and seats are generated automatically",
      "Seats fill fairly, first-come, with zero manual bookkeeping",
      "See your confirmed passenger list at a glance",
    ],
  },
];

const VALUES = [
  {
    title: "Never double-booked",
    Icon: ShieldCheckIcon,
    gradient: "from-primary-500 to-primary-700",
    body: "Every seat hold is protected at the database level, so two riders can never end up with the same seat — even tapping at the exact same moment.",
  },
  {
    title: "Built for everyone",
    Icon: HandRaisedIcon,
    gradient: "from-brand-500 to-brand-700",
    body: "Large tap targets, icons alongside every colour, and layouts that hold up for elderly and low-vision riders, not just power users.",
  },
  {
    title: "Always free",
    Icon: GiftIcon,
    gradient: "from-emerald-500 to-emerald-700",
    body: "No payment details, ever. SahyogRide only exists to allocate seats that NGOs and hospitals are already giving away for free.",
  },
  {
    title: "Fair by design",
    Icon: ScaleIcon,
    gradient: "from-amber-500 to-amber-700",
    body: "First-come, first-served. No priority tiers, no manual favoritism — the seat map is the same for every rider.",
  },
];

const PREVIEW_SEATS = [
  { id: 1, seat_number: "1", status: "reserved", held_by_me: false },
  { id: 2, seat_number: "2", status: "available", held_by_me: false },
  { id: 3, seat_number: "3", status: "held", held_by_me: true },
  { id: 4, seat_number: "4", status: "available", held_by_me: false },
  { id: 5, seat_number: "5", status: "available", held_by_me: false },
  { id: 6, seat_number: "6", status: "reserved", held_by_me: false },
  { id: 7, seat_number: "7", status: "held", held_by_me: false },
  { id: 8, seat_number: "8", status: "available", held_by_me: false },
];

const WITHOUT_SAHYOGRIDE = [
  "Phone calls and texts back and forth to confirm a single seat",
  "Spreadsheets that go out of date the moment someone cancels",
  "No way to know if a seat's really open until you show up",
  "Real risk of two people being told the same seat is theirs",
];

const WITH_SAHYOGRIDE = [
  "Hold a seat instantly, right from your phone",
  "A live seat map that's always accurate",
  "Confirmed the moment you tap — no waiting on a callback",
  "Never double-booked, guaranteed at the database level",
];

const TESTIMONIALS = [
  {
    name: "Ayesha R.",
    role: "Rider",
    quote:
      "I held a seat for my mother's dialysis appointment in under a minute — no phone calls, no waiting on someone to confirm.",
  },
  {
    name: "Ramesh K.",
    role: "Rider",
    quote:
      "The seat map made it obvious which seats were actually open. I never had to guess or ask twice.",
  },
  {
    name: "Priya N.",
    role: "Coordinator, community health outreach",
    quote:
      "Publishing a trip takes seconds and the seats fill themselves out fairly — no spreadsheet, no double-bookings.",
  },
  {
    name: "Farhan S.",
    role: "Rider",
    quote: "Free, simple, and it actually respected that my seat was mine once I confirmed it.",
  },
  {
    name: "Meera D.",
    role: "Coordinator, hospital shuttle program",
    quote: "I can see exactly who's confirmed for each trip without a single phone call.",
  },
];

const FAQS = [
  {
    q: "Is SahyogRide really free?",
    a: "Yes, always. No payment information is ever collected. Every seat is offered free by the NGO or hospital that published the trip — SahyogRide's only job is fair allocation.",
  },
  {
    q: "What happens if I don't confirm in time?",
    a: "Holding a seat reserves it for a few minutes while you confirm. If time runs out, it automatically goes back to available so someone else can take it.",
  },
  {
    q: "What if two people tap the same seat at once?",
    a: "Only one of them gets it. SahyogRide is built so a seat can never be double-booked, even under heavy simultaneous demand — the other rider sees a calm message and can pick another seat.",
  },
  {
    q: "Who can publish a trip?",
    a: "Any registered coordinator — typically an NGO, hospital, or community organization — can publish a trip with open seats for riders who need it.",
  },
];

function AnimatedCounter({ value, prefix = "", suffix = "", duration = 1.1 }) {
  const reduceMotion = useReducedMotion();
  const [display, setDisplay] = useState(reduceMotion ? value : 0);
  const started = useRef(false);

  function start() {
    if (started.current || reduceMotion) return;
    started.current = true;
    const startTime = performance.now();
    function tick(now) {
      const progress = Math.min(1, (now - startTime) / (duration * 1000));
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(eased * value));
      if (progress < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }

  return (
    <motion.span
      onViewportEnter={start}
      viewport={{ once: true, amount: 0.6 }}
      className="gradient-text-animated text-4xl sm:text-5xl tabular-nums"
    >
      {prefix}
      {display}
      {suffix}
    </motion.span>
  );
}

function FaqItem({ q, a, isOpen, onToggle, reduceMotion }) {
  return (
    <div className="card overflow-hidden hover:shadow-lg hover:border-primary-200 transition-shadow">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        className="w-full min-h-[44px] flex items-center justify-between gap-4 px-5 py-4 text-left hover:bg-primary-50/50 transition"
      >
        <span className="font-heading font-semibold text-gray-900">{q}</span>
        <motion.span
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.2 }}
          className="text-gray-400 shrink-0"
        >
          <ChevronDownIcon className="w-5 h-5" aria-hidden="true" />
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={reduceMotion ? false : { height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={reduceMotion ? {} : { height: 0, opacity: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.25, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <p className="px-5 pb-4 text-sm text-gray-600">{a}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function Landing() {
  const reduceMotion = useReducedMotion();
  const [openFaq, setOpenFaq] = useState(0);
  const [hoveredAudience, setHoveredAudience] = useState(-1);
  const [hoveredStep, setHoveredStep] = useState(-1);
  const [hoveredValue, setHoveredValue] = useState(-1);
  const [scrolled, setScrolled] = useState(false);
  const spotlightRef = useRef(null);
  const [spotlightVisible, setSpotlightVisible] = useState(false);
  const heroRef = useRef(null);
  const { scrollYProgress: heroProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });
  const parallaxY = useTransform(heroProgress, [0, 1], [0, 70]);

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 8);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  function handleHeroMouseMove(e) {
    if (reduceMotion || !spotlightRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    spotlightRef.current.style.setProperty("--x", `${e.clientX - rect.left}px`);
    spotlightRef.current.style.setProperty("--y", `${e.clientY - rect.top}px`);
  }

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
    <div className="min-h-screen relative overflow-hidden pb-20 lg:pb-0">
      <BackgroundBlobs />

      <motion.header
        initial={reduceMotion ? false : { opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className={`sticky top-0 z-30 transition-[background-color,box-shadow,backdrop-filter] duration-300 ${
          scrolled ? "bg-white/80 backdrop-blur shadow-sm" : "bg-transparent"
        }`}
      >
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <span className="brand-wordmark text-xl">SahyogRide</span>
          <div className="flex items-center gap-2">
            <Link to="/login" className="btn-secondary">
              Log in
            </Link>
            <Link to="/register" className="btn-primary">
              Get started
            </Link>
          </div>
        </div>
      </motion.header>

      <section
        ref={heroRef}
        onMouseEnter={() => setSpotlightVisible(true)}
        onMouseLeave={() => setSpotlightVisible(false)}
        onMouseMove={handleHeroMouseMove}
        className="relative max-w-5xl mx-auto px-4 pt-8 pb-20 grid items-center gap-10 sm:grid-cols-2"
      >
        <div
          ref={spotlightRef}
          aria-hidden="true"
          className={`hero-spotlight ${spotlightVisible ? "hero-spotlight-visible" : ""}`}
        />
        <motion.div
          variants={heroContainer}
          initial="hidden"
          animate="show"
          className="relative text-center sm:text-left"
        >
          <motion.h1
            variants={heroItem}
            className="font-heading text-4xl sm:text-5xl font-extrabold text-gray-900 leading-tight"
          >
            Free rides for the trips that
            <span className="gradient-text-animated"> matter most</span>
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
            <Magnetic>
              <Link to="/register" className="btn-primary">
                Find a ride
              </Link>
            </Magnetic>
            <Magnetic>
              <Link to="/login" className="btn-secondary">
                I already have an account
              </Link>
            </Magnetic>
          </motion.div>

          <motion.ul
            variants={heroItem}
            className="mt-8 flex flex-wrap justify-center sm:justify-start gap-2"
          >
            {TRUST_BADGES.map((badge) => (
              <motion.li
                key={badge}
                whileHover={reduceMotion ? {} : { scale: 1.06, y: -1 }}
                className="text-xs font-medium text-primary-700 bg-primary-50 border border-primary-100 rounded-full px-3 py-1"
              >
                {badge}
              </motion.li>
            ))}
          </motion.ul>
        </motion.div>

        <motion.div style={{ y: reduceMotion ? 0 : parallaxY }} className="hidden sm:block">
          <motion.div
            initial={reduceMotion ? false : { opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1, y: reduceMotion ? 0 : [0, -10, 0] }}
            transition={{
              opacity: { duration: 0.6, delay: 0.15, ease: "easeOut" },
              scale: { duration: 0.6, delay: 0.15, ease: "easeOut" },
              y: { duration: 5, delay: 0.7, repeat: Infinity, ease: "easeInOut" },
            }}
            className="relative"
          >
            <HeroIllustration />
          </motion.div>
        </motion.div>
      </section>

      <section className="max-w-4xl mx-auto px-4 pb-24">
        <div className="grid grid-cols-3 divide-x divide-gray-200 rounded-2xl border border-gray-200 bg-white/60 backdrop-blur">
          {FACTS.map((fact) => (
            <div key={fact.label} className="px-3 py-6 text-center">
              <AnimatedCounter value={fact.value} prefix={fact.prefix} suffix={fact.suffix} />
              <p className="mt-1 text-xs sm:text-sm text-gray-600">{fact.label}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="who-its-for" className="relative">
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 bg-gradient-to-b from-primary-50/60 via-brand-50/25 to-transparent"
        />
        <div className="max-w-5xl mx-auto px-4 pt-4 pb-24">
        <h2 className="font-heading text-2xl font-bold text-gray-900 text-center mb-10">
          Who it's for
        </h2>
        <div className="grid gap-6 sm:grid-cols-2" onMouseLeave={() => setHoveredAudience(-1)}>
          {AUDIENCES.map((audience, i) => (
            <motion.div
              key={audience.title}
              initial={reduceMotion ? false : { opacity: 0, y: 40, scale: 0.96 }}
              whileInView={{ opacity: 1, y: 0, scale: 1 }}
              viewport={{ once: false, amount: 0.3 }}
              transition={{ duration: 0.5, delay: reduceMotion ? 0 : i * 0.12, ease: "easeOut" }}
            >
              <motion.div
                onMouseEnter={() => setHoveredAudience(i)}
                animate={
                  reduceMotion
                    ? { opacity: 1, y: 0 }
                    : {
                        opacity: hoveredAudience === -1 || hoveredAudience === i ? 1 : 0.5,
                        y: hoveredAudience === i ? -6 : 0,
                      }
                }
                transition={{ duration: 0.25, ease: "easeOut" }}
                className="card p-6 h-full border-2 border-transparent hover:border-brand-300 hover:shadow-lg transition-[border-color,box-shadow]"
              >
                <motion.div
                  whileHover={reduceMotion ? {} : { scale: 1.08, rotate: -4 }}
                  transition={{ type: "spring", stiffness: 300, damping: 15 }}
                  className={`icon-badge bg-gradient-to-br ${audience.gradient} shadow-brand-500/25 mb-4`}
                >
                  <audience.Icon className="w-6 h-6 relative" aria-hidden="true" />
                </motion.div>
                <h3 className="font-heading font-semibold text-gray-900 mb-1">{audience.title}</h3>
                <p className="text-sm text-gray-600 mb-4">{audience.body}</p>
                <ul className="space-y-2">
                  {audience.points.map((point) => (
                    <li key={point} className="flex items-start gap-2 text-sm text-gray-600">
                      <CheckCircleIcon className="w-4 h-4 text-brand-500 mt-0.5 shrink-0" aria-hidden="true" />
                      {point}
                    </li>
                  ))}
                </ul>
              </motion.div>
            </motion.div>
          ))}
        </div>
        </div>
      </section>

      <section id="how-it-works" className="max-w-5xl mx-auto px-4 pb-24">
        <h2 className="font-heading text-2xl font-bold text-gray-900 text-center mb-10">
          How it works
        </h2>
        <div className="grid gap-6 sm:grid-cols-3" onMouseLeave={() => setHoveredStep(-1)}>
          {STEPS.map((step, i) => (
            <motion.div
              key={step.title}
              initial={reduceMotion ? false : { opacity: 0, y: 40, scale: 0.96 }}
              whileInView={{ opacity: 1, y: 0, scale: 1 }}
              viewport={{ once: false, amount: 0.3 }}
              transition={{ duration: 0.5, delay: reduceMotion ? 0 : i * 0.12, ease: "easeOut" }}
            >
              <motion.div
                onMouseEnter={() => setHoveredStep(i)}
                animate={
                  reduceMotion
                    ? { opacity: 1, y: 0 }
                    : {
                        opacity: hoveredStep === -1 || hoveredStep === i ? 1 : 0.5,
                        y: hoveredStep === i ? -6 : 0,
                      }
                }
                transition={{ duration: 0.25, ease: "easeOut" }}
                className={`relative overflow-hidden rounded-2xl p-6 h-full text-white bg-gradient-to-br ${step.gradient} shadow-md hover:shadow-xl transition-shadow`}
              >
                <span
                  aria-hidden="true"
                  className="absolute -right-2 -top-4 font-heading font-extrabold text-7xl text-white/15 select-none"
                >
                  {step.number}
                </span>
                <motion.div
                  whileHover={reduceMotion ? {} : { scale: 1.08, rotate: 4 }}
                  transition={{ type: "spring", stiffness: 300, damping: 15 }}
                  className="icon-badge-on-color mb-4"
                >
                  <step.Icon className="w-6 h-6" aria-hidden="true" />
                </motion.div>
                <h3 className="relative font-heading font-semibold mb-1">{step.title}</h3>
                <p className="relative text-sm text-white/85">{step.body}</p>
              </motion.div>
            </motion.div>
          ))}
        </div>
      </section>

      <section className="max-w-4xl mx-auto px-4 pb-24">
        <h2 className="font-heading text-2xl font-bold text-gray-900 text-center mb-2">
          See the seat map
        </h2>
        <p className="text-center text-sm text-gray-600 mb-10">
          This is the actual seat map riders use — not a mockup.
        </p>

        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: false, amount: 0.3 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="glass-card overflow-hidden"
        >
          <div className="flex items-center gap-1.5 px-4 py-3 bg-white/50 backdrop-blur border-b border-white/60">
            <span className="w-2.5 h-2.5 rounded-full bg-red-400" aria-hidden="true" />
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400" aria-hidden="true" />
            <span className="w-2.5 h-2.5 rounded-full bg-green-400" aria-hidden="true" />
            <span className="ml-3 text-xs text-gray-500 font-mono">sahyogride.app/trips/12</span>
          </div>
          <div className="p-6">
            <p className="font-heading font-semibold text-gray-900">
              City Hospital &rarr; Railway Station
            </p>
            <p className="text-sm text-gray-500 mb-5">Tomorrow, 9:30 AM &middot; medical</p>
            <SeatMap seats={PREVIEW_SEATS} />
          </div>
        </motion.div>
      </section>

      <section className="max-w-4xl mx-auto px-4 pb-24">
        <h2 className="font-heading text-2xl font-bold text-gray-900 text-center mb-10">
          The old way, versus SahyogRide
        </h2>
        <div className="grid gap-6 sm:grid-cols-2">
          <motion.div
            initial={reduceMotion ? false : { opacity: 0, x: -24 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: false, amount: 0.4 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="rounded-2xl border border-gray-200 bg-gray-50 p-6"
          >
            <h3 className="font-heading font-semibold text-gray-500 mb-4">Without SahyogRide</h3>
            <ul className="space-y-3">
              {WITHOUT_SAHYOGRIDE.map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm text-gray-500">
                  <XCircleIcon className="w-5 h-5 text-gray-400 mt-0.5 shrink-0" aria-hidden="true" />
                  {item}
                </li>
              ))}
            </ul>
          </motion.div>

          <motion.div
            initial={reduceMotion ? false : { opacity: 0, x: 24 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: false, amount: 0.4 }}
            transition={{ duration: 0.5, delay: 0.1, ease: "easeOut" }}
            className="rounded-2xl border-2 border-primary-200 bg-primary-50/50 p-6"
          >
            <h3 className="font-heading font-semibold text-primary-700 mb-4">With SahyogRide</h3>
            <ul className="space-y-3">
              {WITH_SAHYOGRIDE.map((item) => (
                <li key={item} className="flex items-start gap-2 text-sm text-gray-700">
                  <CheckCircleIcon className="w-5 h-5 text-primary-600 mt-0.5 shrink-0" aria-hidden="true" />
                  {item}
                </li>
              ))}
            </ul>
          </motion.div>
        </div>
      </section>

      <section id="why-sahyogride" className="relative">
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10 bg-gradient-to-b from-brand-50/50 via-primary-50/25 to-transparent"
        />
        <div className="max-w-5xl mx-auto px-4 pt-4 pb-24">
        <h2 className="font-heading text-2xl font-bold text-gray-900 text-center mb-10">
          Why SahyogRide
        </h2>
        <div
          className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4"
          onMouseLeave={() => setHoveredValue(-1)}
        >
          {VALUES.map((value, i) => (
            <motion.div
              key={value.title}
              initial={reduceMotion ? false : { opacity: 0, y: 40, scale: 0.96 }}
              whileInView={{ opacity: 1, y: 0, scale: 1 }}
              viewport={{ once: false, amount: 0.3 }}
              transition={{ duration: 0.5, delay: reduceMotion ? 0 : i * 0.1, ease: "easeOut" }}
            >
              <motion.div
                onMouseEnter={() => setHoveredValue(i)}
                animate={
                  reduceMotion
                    ? { opacity: 1, scale: 1 }
                    : {
                        opacity: hoveredValue === -1 || hoveredValue === i ? 1 : 0.5,
                        scale: hoveredValue === i ? 1.05 : hoveredValue === -1 ? 1 : 0.96,
                      }
                }
                transition={{ duration: 0.25, ease: "easeOut" }}
                className="card p-5 h-full hover:shadow-lg transition-shadow"
              >
                <motion.div
                  whileHover={reduceMotion ? {} : { scale: 1.08 }}
                  transition={{ type: "spring", stiffness: 300, damping: 15 }}
                  className={`icon-badge w-11 h-11 bg-gradient-to-br ${value.gradient} mb-3`}
                >
                  <value.Icon className="w-5 h-5 relative" aria-hidden="true" />
                </motion.div>
                <h3 className="font-heading font-semibold text-gray-900 mb-1 text-sm">{value.title}</h3>
                <p className="text-xs text-gray-600">{value.body}</p>
              </motion.div>
            </motion.div>
          ))}
        </div>
        </div>
      </section>

      <section className="pb-24">
        <div className="max-w-5xl mx-auto px-4">
          <h2 className="font-heading text-2xl font-bold text-gray-900 text-center mb-2">
            What people are saying
          </h2>
          <p className="text-center text-xs text-gray-400 mb-10">
            Illustrative examples — placeholder testimonials for a platform still in development.
          </p>
        </div>

        <ul className="sr-only">
          {TESTIMONIALS.map((t) => (
            <li key={t.name}>
              {t.name}, {t.role}: &ldquo;{t.quote}&rdquo;
            </li>
          ))}
        </ul>

        <div
          aria-hidden="true"
          className="overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_5%,black_95%,transparent)]"
        >
          <div className="marquee-track flex gap-5 w-max">
            {[...TESTIMONIALS, ...TESTIMONIALS].map((t, i) => (
              <div
                key={`${t.name}-${i}`}
                className="glass-card relative p-5 w-80 shrink-0 hover:shadow-2xl hover:-translate-y-1.5 hover:border-primary-200 transition-all duration-300"
              >
                <span
                  className="absolute top-3 right-4 font-heading text-5xl text-primary-100 select-none"
                  aria-hidden="true"
                >
                  &rdquo;
                </span>
                <div className="flex items-center gap-3 mb-3">
                  <Avatar name={t.name} index={i} />
                  <div>
                    <p className="font-heading font-semibold text-gray-900 text-sm">{t.name}</p>
                    <p className="text-xs text-gray-500">{t.role}</p>
                  </div>
                </div>
                <p className="relative text-sm text-gray-600">&ldquo;{t.quote}&rdquo;</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section id="faq" className="max-w-3xl mx-auto px-4 pb-24">
        <h2 className="font-heading text-2xl font-bold text-gray-900 text-center mb-10">
          Frequently asked questions
        </h2>
        <div className="space-y-3">
          {FAQS.map((faq, i) => (
            <motion.div
              key={faq.q}
              initial={reduceMotion ? false : { opacity: 0, y: 28 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: false, amount: 0.6 }}
              transition={{ duration: 0.4, delay: reduceMotion ? 0 : i * 0.08, ease: "easeOut" }}
            >
              <FaqItem
                q={faq.q}
                a={faq.a}
                isOpen={openFaq === i}
                onToggle={() => setOpenFaq(openFaq === i ? -1 : i)}
                reduceMotion={reduceMotion}
              />
            </motion.div>
          ))}
        </div>
      </section>

      <section className="px-4 pb-20">
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: false, amount: 0.4 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="relative overflow-hidden max-w-4xl mx-auto rounded-3xl bg-gradient-to-r from-primary-600 to-brand-600 text-center px-8 py-14 text-white"
        >
          <div className="absolute inset-0 opacity-80">
            <Fireworks className="pointer-events-none" />
          </div>

          <div className="relative">
            <h2 className="font-heading text-3xl font-bold mb-3">Ready to find your ride?</h2>
            <p className="text-white/85 max-w-md mx-auto mb-8">
              Search free shuttle trips near you and hold a seat in seconds — no calls, no
              spreadsheets, no payment details.
            </p>
            <Magnetic>
              <Link
                to="/register"
                className="ripple-target relative overflow-hidden inline-flex items-center justify-center min-h-[44px] px-6 rounded-xl font-medium bg-white text-primary-700 hover:bg-gray-50 hover:scale-[1.03] active:scale-[0.97] transition"
              >
                Get started for free
              </Link>
            </Magnetic>
          </div>
        </motion.div>
      </section>

      <footer className="border-t border-gray-200 bg-white/60 backdrop-blur">
        <div className="max-w-5xl mx-auto px-4 py-12 grid gap-10 sm:grid-cols-3">
          <div>
            <span className="brand-wordmark text-xl">SahyogRide</span>
            <p className="mt-3 text-sm text-gray-600 max-w-xs">
              A free, non-commercial platform that helps NGOs and hospitals allocate shuttle
              seats fairly — no payments, ever.
            </p>
            <ul className="mt-4 flex flex-wrap gap-2">
              {TRUST_BADGES.map((badge) => (
                <li
                  key={badge}
                  className="text-xs font-medium text-primary-700 bg-primary-50 border border-primary-100 rounded-full px-3 py-1"
                >
                  {badge}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="font-heading font-semibold text-gray-900 text-sm mb-3">Explore</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <a href="#who-its-for" className="text-gray-600 hover:text-primary-600 transition-colors">
                  Who it's for
                </a>
              </li>
              <li>
                <a href="#how-it-works" className="text-gray-600 hover:text-primary-600 transition-colors">
                  How it works
                </a>
              </li>
              <li>
                <a href="#why-sahyogride" className="text-gray-600 hover:text-primary-600 transition-colors">
                  Why SahyogRide
                </a>
              </li>
              <li>
                <a href="#faq" className="text-gray-600 hover:text-primary-600 transition-colors">
                  FAQ
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="font-heading font-semibold text-gray-900 text-sm mb-3">Get started</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link to="/register" className="text-gray-600 hover:text-primary-600 transition-colors">
                  Create an account
                </Link>
              </li>
              <li>
                <Link to="/login" className="text-gray-600 hover:text-primary-600 transition-colors">
                  Log in
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-200">
          <div className="max-w-5xl mx-auto px-4 py-5 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-gray-500">
            <p>&copy; {new Date().getFullYear()} SahyogRide. Non-commercial community project.</p>
            <p>No payments, ever &middot; Never double-booked</p>
          </div>
        </div>
      </footer>

      <div className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-white/95 backdrop-blur border-t border-gray-200 px-4 py-3 pb-[env(safe-area-inset-bottom)]">
        <Link to="/register" className="btn-primary w-full">
          Get started
        </Link>
      </div>
    </div>
  );
}
