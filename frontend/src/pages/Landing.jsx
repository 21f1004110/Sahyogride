import { useState } from "react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
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
} from "@heroicons/react/24/outline";

import Avatar from "../components/Avatar";
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

const AUDIENCES = [
  {
    title: "Riders",
    Icon: UserIcon,
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
    body: "Every seat hold is protected at the database level, so two riders can never end up with the same seat — even tapping at the exact same moment.",
  },
  {
    title: "Built for everyone",
    Icon: HandRaisedIcon,
    body: "Large tap targets, icons alongside every colour, and layouts that hold up for elderly and low-vision riders, not just power users.",
  },
  {
    title: "Always free",
    Icon: GiftIcon,
    body: "No payment details, ever. SahyogRide only exists to allocate seats that NGOs and hospitals are already giving away for free.",
  },
  {
    title: "Fair by design",
    Icon: ScaleIcon,
    body: "First-come, first-served. No priority tiers, no manual favoritism — the seat map is the same for every rider.",
  },
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
          Who it's for
        </h2>
        <div
          className="grid gap-6 sm:grid-cols-2"
          onMouseLeave={() => setHoveredAudience(-1)}
        >
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
                  whileHover={reduceMotion ? {} : { scale: 1.1, rotate: -4 }}
                  transition={{ type: "spring", stiffness: 300, damping: 15 }}
                  className="w-11 h-11 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center mb-4"
                >
                  <audience.Icon className="w-6 h-6" aria-hidden="true" />
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
      </section>

      <section className="max-w-5xl mx-auto px-4 pb-24">
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
                className="card p-6 h-full border-2 border-transparent hover:border-primary-300 hover:shadow-lg transition-[border-color,box-shadow]"
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
            </motion.div>
          ))}
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-4 pb-24">
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
                  animate={
                    reduceMotion
                      ? {}
                      : {
                          backgroundColor: hoveredValue === i ? "#4F46E5" : "#EEF2FF",
                          color: hoveredValue === i ? "#FFFFFF" : "#4338CA",
                        }
                  }
                  transition={{ duration: 0.25 }}
                  className="w-10 h-10 rounded-full flex items-center justify-center mb-3"
                >
                  <value.Icon className="w-5 h-5" aria-hidden="true" />
                </motion.div>
                <h3 className="font-heading font-semibold text-gray-900 mb-1 text-sm">{value.title}</h3>
                <p className="text-xs text-gray-600">{value.body}</p>
              </motion.div>
            </motion.div>
          ))}
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

        <div
          aria-hidden="true"
          className="overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_5%,black_95%,transparent)]"
        >
          <div className="marquee-track flex gap-5 w-max">
            {[...TESTIMONIALS, ...TESTIMONIALS].map((t, i) => (
              <div
                key={`${t.name}-${i}`}
                className="card p-5 w-80 shrink-0 hover:shadow-lg hover:-translate-y-1 hover:border-primary-300 transition"
              >
                <div className="flex items-center gap-3 mb-3">
                  <Avatar name={t.name} index={i} />
                  <div>
                    <p className="font-heading font-semibold text-gray-900 text-sm">{t.name}</p>
                    <p className="text-xs text-gray-500">{t.role}</p>
                  </div>
                </div>
                <p className="text-sm text-gray-600">&ldquo;{t.quote}&rdquo;</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="max-w-3xl mx-auto px-4 pb-24">
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

      <footer className="max-w-5xl mx-auto px-4 pb-10 text-center text-sm text-gray-500">
        SahyogRide is a free, non-commercial community shuttle platform. No payments, ever.
      </footer>
    </div>
  );
}
