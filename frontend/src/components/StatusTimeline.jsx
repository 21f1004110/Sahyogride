import { CheckCircleIcon, FlagIcon, TruckIcon, XCircleIcon } from "@heroicons/react/24/outline";

// Demo-only: "En route"/"Arrived" are derived client-side from
// departure_time, not real backend state - see SAHYOG-34.
const EN_ROUTE_WINDOW_MINUTES = 30;
const TRIP_DURATION_MINUTES = 25;

const STEPS = [
  { key: "booked", label: "Booked", icon: CheckCircleIcon },
  { key: "en_route", label: "En route", icon: TruckIcon },
  { key: "arrived", label: "Arrived", icon: FlagIcon },
];

function deriveStepIndex(departureTime) {
  const departure = new Date(departureTime).getTime();
  const enRouteStart = departure - EN_ROUTE_WINDOW_MINUTES * 60 * 1000;
  const arrivedAt = departure + TRIP_DURATION_MINUTES * 60 * 1000;
  const now = Date.now();
  if (now >= arrivedAt) return 2;
  if (now >= enRouteStart) return 1;
  return 0;
}

export default function StatusTimeline({ departureTime, cancelled }) {
  if (cancelled) {
    return (
      <p role="status" className="flex items-center gap-2 text-sm text-gray-500">
        <XCircleIcon className="w-4 h-4 shrink-0" aria-hidden="true" />
        Cancelled — no longer tracked
      </p>
    );
  }

  const currentIndex = deriveStepIndex(departureTime);

  return (
    <ol aria-label="Trip status" className="flex items-start">
      {STEPS.map((step, i) => {
        const done = i < currentIndex;
        const active = i === currentIndex;
        const Icon = step.icon;
        return (
          <li key={step.key} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-1 w-16">
              <span
                className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${
                  done || active
                    ? "bg-primary-600 border-primary-600 text-white"
                    : "bg-white border-gray-200 text-gray-400"
                }`}
              >
                <Icon className="w-4 h-4" aria-hidden="true" />
              </span>
              <span
                className={`text-[11px] font-medium text-center ${
                  active ? "text-primary-700" : done ? "text-gray-700" : "text-gray-400"
                }`}
              >
                {step.label}
              </span>
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={`flex-1 h-0.5 mx-1 mt-4 ${done ? "bg-primary-600" : "bg-gray-200"}`}
                aria-hidden="true"
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
