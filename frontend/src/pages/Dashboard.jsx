import { Link } from "react-router-dom";

import { useAuth } from "../context/AuthContext";

export default function Dashboard() {
  const { user } = useAuth();

  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <h1 className="font-heading text-3xl font-bold text-gray-900">
        Welcome back, {user.name.split(" ")[0]}
      </h1>
      <p className="mt-2 text-gray-600">
        You're signed in as a <span className="font-medium">{user.role}</span>.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <Link to="/trips" className="card p-6 hover:shadow-md transition">
          <h2 className="font-heading font-semibold text-gray-900 mb-1">Search trips</h2>
          <p className="text-sm text-gray-600">Find a free shuttle trip and hold a seat.</p>
        </Link>

        {user.role === "coordinator" && (
          <Link to="/trips/new" className="card p-6 hover:shadow-md transition">
            <h2 className="font-heading font-semibold text-gray-900 mb-1">Create a trip</h2>
            <p className="text-sm text-gray-600">Publish a new free shuttle trip with open seats.</p>
          </Link>
        )}
      </div>
    </div>
  );
}
