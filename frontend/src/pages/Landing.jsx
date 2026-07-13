import { Link } from "react-router-dom";
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
  return (
    <div className="min-h-screen relative overflow-hidden">
      <BackgroundBlobs />

      <header className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
        <span className="brand-wordmark text-xl">SahyogRide</span>
        <div className="flex items-center gap-2">
          <Link to="/login" className="btn-secondary">
            Log in
          </Link>
          <Link to="/register" className="btn-primary">
            Get started
          </Link>
        </div>
      </header>

      <section className="max-w-5xl mx-auto px-4 pt-8 pb-20 grid items-center gap-10 sm:grid-cols-2">
        <div className="text-center sm:text-left">
          <h1 className="font-heading text-4xl sm:text-5xl font-extrabold text-gray-900 leading-tight">
            Free rides for the trips that
            <span className="brand-wordmark"> matter most</span>
          </h1>
          <p className="mt-5 text-lg text-gray-600 max-w-xl mx-auto sm:mx-0">
            NGOs and hospitals publish free shuttle trips for essential travel — medical visits,
            exams, work. SahyogRide helps people in need find a seat, fairly and without a single
            seat ever double-booked.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center sm:justify-start gap-3">
            <Link to="/register" className="btn-primary">
              Find a ride
            </Link>
            <Link to="/login" className="btn-secondary">
              I already have an account
            </Link>
          </div>

          <ul className="mt-8 flex flex-wrap justify-center sm:justify-start gap-2">
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

        <div className="hidden sm:block">
          <HeroIllustration />
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-4 pb-24">
        <h2 className="font-heading text-2xl font-bold text-gray-900 text-center mb-10">
          How it works
        </h2>
        <div className="grid gap-6 sm:grid-cols-3">
          {STEPS.map((step) => (
            <div key={step.title} className="card p-6">
              <div className="w-11 h-11 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center mb-4">
                <step.Icon className="w-6 h-6" aria-hidden="true" />
              </div>
              <h3 className="font-heading font-semibold text-gray-900 mb-1">{step.title}</h3>
              <p className="text-sm text-gray-600">{step.body}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="max-w-5xl mx-auto px-4 pb-10 text-center text-sm text-gray-500">
        SahyogRide is a free, non-commercial community shuttle platform. No payments, ever.
      </footer>
    </div>
  );
}
