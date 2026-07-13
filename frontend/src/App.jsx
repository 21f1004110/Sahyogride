import { Link, Navigate, Route, Routes } from "react-router-dom";

import { useAuth } from "./context/AuthContext";
import Login from "./pages/Login";
import Register from "./pages/Register";
import CreateTrip from "./pages/CreateTrip";
import SearchTrips from "./pages/SearchTrips";

function Home() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4">
      <h1 className="text-2xl font-semibold">SahyogRide</h1>
      {user ? (
        <div className="text-center space-y-2">
          <p>
            Signed in as {user.name} ({user.role})
          </p>
          <p>
            <Link to="/trips" className="underline">
              Search trips
            </Link>
          </p>
          {user.role === "coordinator" && (
            <p>
              <Link to="/trips/new" className="underline">
                Create a trip
              </Link>
            </p>
          )}
          <button onClick={logout} className="mt-2 min-h-[44px] px-4 underline">
            Log out
          </button>
        </div>
      ) : (
        <p>Not signed in.</p>
      )}
    </div>
  );
}

function RequireAuth({ children }) {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? children : <Navigate to="/login" replace />;
}

function RequireCoordinator({ children }) {
  const { user, isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (user.role !== "coordinator") return <Navigate to="/" replace />;
  return children;
}

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route
        path="/"
        element={
          <RequireAuth>
            <Home />
          </RequireAuth>
        }
      />
      <Route
        path="/trips"
        element={
          <RequireAuth>
            <SearchTrips />
          </RequireAuth>
        }
      />
      <Route
        path="/trips/new"
        element={
          <RequireCoordinator>
            <CreateTrip />
          </RequireCoordinator>
        }
      />
    </Routes>
  );
}

export default App;
