export default function Loading() {
  return (
    <p role="status" className="flex items-center gap-2 text-gray-500 py-6 justify-center">
      <span
        aria-hidden="true"
        className="w-4 h-4 rounded-full border-2 border-primary-300 border-t-primary-600 animate-spin"
      />
      Loading…
    </p>
  );
}

export function TripCardSkeleton() {
  return (
    <div className="card p-5" aria-hidden="true">
      <div className="skeleton h-5 w-3/4 mb-4" />
      <div className="space-y-2">
        <div className="skeleton h-3.5 w-1/2" />
        <div className="skeleton h-3.5 w-2/5" />
        <div className="skeleton h-3.5 w-1/3" />
      </div>
      <div className="mt-4 skeleton h-2 w-full rounded-full" />
    </div>
  );
}

export function TripListSkeleton({ count = 4 }) {
  return (
    <div role="status" aria-label="Loading trips" className="grid gap-4 sm:grid-cols-2">
      {Array.from({ length: count }).map((_, i) => (
        <TripCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function TripDetailSkeleton() {
  return (
    <div role="status" aria-label="Loading trip" className="max-w-5xl mx-auto px-4 py-10">
      <div className="skeleton h-8 w-2/3 max-w-md mb-6" />
      <div className="grid gap-8 lg:grid-cols-[320px_1fr] items-start">
        <div className="space-y-6">
          <div className="card p-5 space-y-3">
            <div className="skeleton h-4 w-3/4" />
            <div className="skeleton h-4 w-1/2" />
            <div className="skeleton h-4 w-2/3" />
          </div>
          <div className="card p-5 space-y-3">
            <div className="skeleton h-4 w-1/3 mb-2" />
            <div className="skeleton h-4 w-full" />
            <div className="skeleton h-4 w-full" />
            <div className="skeleton h-4 w-full" />
          </div>
        </div>
        <div className="card p-6">
          <div className="skeleton h-4 w-1/2 mb-4" />
          <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 gap-3">
            {Array.from({ length: 24 }).map((_, i) => (
              <div key={i} className="skeleton aspect-square rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
