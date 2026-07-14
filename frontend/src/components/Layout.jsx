import { Link, useLocation } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowRightStartOnRectangleIcon, PlusIcon } from "@heroicons/react/24/outline";
import { MagnifyingGlassIcon } from "@heroicons/react/24/solid";

import { useAuth } from "../context/AuthContext";
import BackgroundBlobs from "./BackgroundBlobs";
import Avatar from "./Avatar";

function NavLink({ to, children }) {
  const location = useLocation();
  const active = location.pathname === to;
  return (
    <Link to={to} className={`nav-link ${active ? "nav-link-active" : ""}`}>
      {children}
    </Link>
  );
}

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const reduceMotion = useReducedMotion();

  return (
    <div className="min-h-screen relative">
      <BackgroundBlobs />

      <header className="bg-white/80 backdrop-blur border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
          <Link to="/" className="brand-wordmark text-xl shrink-0">
            SahyogRide
          </Link>

          {user && (
            <nav className="flex items-center gap-2 sm:gap-5 text-sm">
              <NavLink to="/trips">
                <MagnifyingGlassIcon className="w-4 h-4 mr-1.5 hidden sm:inline" aria-hidden="true" />
                Search trips
              </NavLink>
              {user.role === "coordinator" && (
                <NavLink to="/trips/new">
                  <PlusIcon className="w-4 h-4 mr-1.5 hidden sm:inline" aria-hidden="true" />
                  Create a trip
                </NavLink>
              )}

              <div className="w-px h-6 bg-gray-200 hidden sm:block" aria-hidden="true" />

              <div className="hidden sm:flex items-center gap-2 pl-1">
                <Avatar name={user.name} index={user.id ?? 0} small />
                <span className="text-gray-700 font-medium max-w-[9rem] truncate">{user.name}</span>
              </div>

              <button
                onClick={logout}
                aria-label="Log out"
                title="Log out"
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-gray-500 hover:text-gray-900 hover:bg-gray-100 active:scale-95 transition"
              >
                <ArrowRightStartOnRectangleIcon className="w-5 h-5" aria-hidden="true" />
              </button>
            </nav>
          )}
        </div>
      </header>

      <AnimatePresence mode="wait" initial={false}>
        <motion.main
          key={location.pathname}
          initial={reduceMotion ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduceMotion ? {} : { opacity: 0 }}
          transition={{ duration: 0.22, ease: "easeOut" }}
        >
          {children}
        </motion.main>
      </AnimatePresence>
    </div>
  );
}
