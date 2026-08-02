import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowLeftIcon,
  EyeSlashIcon,
  ExclamationTriangleIcon,
  FaceSmileIcon,
  HandRaisedIcon,
  HeartIcon,
  InformationCircleIcon,
  MinusCircleIcon,
  QuestionMarkCircleIcon,
  SparklesIcon,
  SpeakerXMarkIcon,
  UserGroupIcon,
  UserIcon,
} from "@heroicons/react/24/outline";

import { getTripPassengers } from "../api/trips";
import Empty from "../components/states/Empty";
import ErrorState from "../components/states/ErrorState";
import Loading from "../components/states/Loading";

const URGENCY = {
  high: { badge: "badge-red", icon: ExclamationTriangleIcon, label: "High urgency" },
  medium: { badge: "badge-amber", icon: InformationCircleIcon, label: "Medium urgency" },
  low: { badge: "badge-gray", icon: MinusCircleIcon, label: "Low urgency" },
};

function UrgencyBadge({ level }) {
  const config = URGENCY[level];
  if (!config) return null;
  const Icon = config.icon;
  return (
    <span className={`${config.badge} shrink-0`}>
      <Icon className="w-3.5 h-3.5" aria-hidden="true" />
      {config.label}
    </span>
  );
}

const ACCESSIBILITY = {
  wheelchair: { badge: "badge-purple", icon: HandRaisedIcon, label: "Wheelchair" },
  mobility_assistance: { badge: "badge-purple", icon: UserIcon, label: "Mobility assistance" },
  visual_impairment: { badge: "badge-pink", icon: EyeSlashIcon, label: "Visual impairment" },
  hearing_impairment: { badge: "badge-pink", icon: SpeakerXMarkIcon, label: "Hearing impairment" },
  elderly_support: { badge: "badge-purple", icon: HeartIcon, label: "Elderly support" },
  child_support: { badge: "badge-pink", icon: FaceSmileIcon, label: "Travelling with a child" },
  other: { badge: "badge-gray", icon: QuestionMarkCircleIcon, label: "Accessibility note" },
};

function AccessibilityBadge({ tag }) {
  const config = ACCESSIBILITY[tag];
  if (!config) return null;
  const Icon = config.icon;
  return (
    <span className={`${config.badge} shrink-0`}>
      <Icon className="w-3.5 h-3.5" aria-hidden="true" />
      {config.label}
    </span>
  );
}

export default function PassengerList() {
  const { id } = useParams();
  const reduceMotion = useReducedMotion();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["trip-passengers", id],
    queryFn: () => getTripPassengers(id),
  });

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <Link
        to="/my-trips"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 mb-4"
      >
        <ArrowLeftIcon className="w-4 h-4" aria-hidden="true" />
        My trips
      </Link>

      <div className="flex items-center gap-3 mb-6">
        <span className="icon-badge bg-gradient-to-br from-primary-500 to-primary-700">
          <UserGroupIcon className="w-6 h-6 relative" aria-hidden="true" />
        </span>
        <div>
          <h1 className="font-heading text-3xl font-bold text-gray-900">Passenger list</h1>
          <p className="text-sm text-gray-600">Trip #{id} &middot; confirmed riders only</p>
        </div>
      </div>

      {isLoading && <Loading />}
      {isError && <ErrorState message="Couldn't load the passenger list." onRetry={refetch} />}

      {!isLoading && !isError && data.passengers.length === 0 && (
        <Empty message="No confirmed passengers yet." />
      )}

      {!isLoading && !isError && data.passengers.length > 0 && (
        <>
          {data.digest && (
            <div className="card p-4 mb-5 flex items-start gap-3 bg-primary-50/60 border-primary-100">
              <SparklesIcon className="w-5 h-5 text-primary-600 shrink-0 mt-0.5" aria-hidden="true" />
              <p className="text-sm text-primary-900">{data.digest}</p>
            </div>
          )}

          <p className="text-sm text-gray-500 mb-4">
            {data.passengers.length} passenger{data.passengers.length === 1 ? "" : "s"} confirmed
          </p>
          <ul className="space-y-3">
            {data.passengers.map((p, i) => (
              <motion.li
                key={p.reservation_id}
                initial={reduceMotion ? false : { opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: reduceMotion ? 0 : i * 0.05, ease: "easeOut" }}
                className="card p-5 flex items-center justify-between gap-4"
              >
                <div className="min-w-0">
                  <p className="font-heading font-semibold text-gray-900 truncate">{p.rider_name}</p>
                  <p className="text-sm text-gray-500 mt-1">
                    Confirmed {new Date(p.confirmed_at).toLocaleString()}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
                  <AccessibilityBadge tag={p.ai_accessibility_tags} />
                  <UrgencyBadge level={p.ai_urgency_label} />
                  <span className="badge-green">Seat {p.seat_number}</span>
                </div>
              </motion.li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
