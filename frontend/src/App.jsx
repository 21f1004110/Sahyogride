import { Navigate, Route, Routes } from "react-router-dom";

import { useAuth } from "./context/AuthContext";
import Layout from "./components/Layout";
import RippleFX from "./components/RippleFX";
import Landing from "./pages/Landing";
import Dashboard from "./pages/Dashboard";
import Login from "./pages/Login";
import Register from "./pages/Register";
import CreateTrip from "./pages/CreateTrip";
import SearchTrips from "./pages/SearchTrips";
import TripDetail from "./pages/TripDetail";
import Confirmation from "./pages/Confirmation";
import MyReservations from "./pages/MyReservations";

function RootRoute() {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? (
    <Layout>
      <Dashboard />
    </Layout>
  ) : (
    <Landing />
  );
}

function RequireAuth({ children }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <Layout>{children}</Layout>;
}

function RequireCoordinator({ children }) {
  const { user, isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (user.role !== "coordinator") return <Navigate to="/" replace />;
  return <Layout>{children}</Layout>;
}

function RedirectIfAuthenticated({ children }) {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <Navigate to="/" replace /> : children;
}

function App() {
  return (
    <>
      <RippleFX />
      <Routes>
        <Route
          path="/login"
          element={
            <RedirectIfAuthenticated>
              <Login />
            </RedirectIfAuthenticated>
          }
        />
        <Route
          path="/register"
          element={
            <RedirectIfAuthenticated>
              <Register />
            </RedirectIfAuthenticated>
          }
        />
        <Route path="/" element={<RootRoute />} />
        <Route
          path="/trips"
          element={
            <RequireAuth>
              <SearchTrips />
            </RequireAuth>
          }
        />
        <Route
          path="/trips/:id"
          element={
            <RequireAuth>
              <TripDetail />
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
        <Route
          path="/confirmation"
          element={
            <RequireAuth>
              <Confirmation />
            </RequireAuth>
          }
        />
        <Route
          path="/reservations"
          element={
            <RequireAuth>
              <MyReservations />
            </RequireAuth>
          }
        />
      </Routes>
    </>
  );
}

export default App;
