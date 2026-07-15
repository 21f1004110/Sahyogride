import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { ShieldCheckIcon } from "@heroicons/react/24/outline";

import BackgroundBlobs from "./BackgroundBlobs";

const HIGHLIGHTS = ["100% free, always", "Never double-booked", "No payments, ever"];

export default function AuthLayout({ children, panelTitle, panelBody }) {
  const reduceMotion = useReducedMotion();

  return (
    <div className="min-h-screen relative flex">
      <BackgroundBlobs />

      <div className="hidden lg:flex lg:w-[45%] xl:w-[40%] relative overflow-hidden bg-gradient-to-br from-primary-600 via-primary-700 to-brand-700 text-white p-12 flex-col justify-between">
        <div aria-hidden="true" className="absolute inset-0">
          <div className="blob-1 absolute -top-24 -left-24 w-72 h-72 rounded-full bg-white/10 blur-3xl" />
          <div className="blob-2 absolute bottom-0 -right-16 w-80 h-80 rounded-full bg-white/10 blur-3xl" />
        </div>

        <Link to="/" className="relative font-heading text-2xl font-extrabold">
          SahyogRide
        </Link>

        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="relative"
        >
          <span className="icon-badge-on-color mb-6">
            <ShieldCheckIcon className="w-6 h-6" aria-hidden="true" />
          </span>
          <h2 className="font-heading text-3xl font-bold leading-tight mb-3">{panelTitle}</h2>
          <p className="text-white/80 max-w-sm">{panelBody}</p>
        </motion.div>

        <ul className="relative flex flex-wrap gap-2">
          {HIGHLIGHTS.map((h) => (
            <li
              key={h}
              className="text-xs font-medium bg-white/15 border border-white/20 rounded-full px-3 py-1"
            >
              {h}
            </li>
          ))}
        </ul>
      </div>

      <div className="flex-1 flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-sm">
          <Link to="/" className="brand-wordmark text-xl block text-center mb-6 lg:hidden">
            SahyogRide
          </Link>
          {children}
        </div>
      </div>
    </div>
  );
}
