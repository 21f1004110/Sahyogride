import { Navigate, Route, Routes } from "react-router-dom";

import { useAuth } from "./context/AuthContext";
import Login from "./pages/Login";
import Register from "./pages/Register";

function Home() {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4">
      <h1 className="text-2xl font-semibold">SahyogRide</h1>
      {user ? (
        <div className="text-center">
          <p>
            Signed in as {user.name} ({user.role})
          </p>
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
    </Routes>
  );
}

export default App;
