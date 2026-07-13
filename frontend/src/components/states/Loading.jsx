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
