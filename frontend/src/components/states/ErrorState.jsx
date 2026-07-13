export default function ErrorState({ message = "Something went wrong.", onRetry }) {
  return (
    <div role="alert" className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
      <p>{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-2 min-h-[44px] inline-flex items-center font-medium underline"
        >
          Retry
        </button>
      )}
    </div>
  );
}
