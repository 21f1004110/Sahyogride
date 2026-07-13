import { Link } from "react-router-dom";

import { useAuth } from "../context/AuthContext";
import BackgroundBlobs from "./BackgroundBlobs";

export default function Layout({ children }) {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen relative">
      <BackgroundBlobs />

      <header className="bg-white/80 backdrop-blur border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" className="brand-wordmark text-xl">
            SahyogRide
          </Link>

          {user && (
            <nav className="flex items-center gap-4 text-sm">
              <Link to="/trips" className="text-gray-700 hover:text-primary-600 font-medium">
                Search trips
              </Link>
              {user.role === "coordinator" && (
                <Link to="/trips/new" className="text-gray-700 hover:text-primary-600 font-medium">
                  Create a trip
                </Link>
              )}
              <span className="hidden sm:inline text-gray-500">{user.name}</span>
              <button
                onClick={logout}
                className="min-h-[44px] px-3 text-gray-600 hover:text-gray-900 font-medium"
              >
                Log out
              </button>
            </nav>
          )}
        </div>
      </header>

      <main>{children}</main>
    </div>
  );
}
