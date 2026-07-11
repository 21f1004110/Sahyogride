export default function ErrorState({ message = "Something went wrong.", onRetry }) {
  return (
    <div role="alert">
      <p>{message}</p>
      {onRetry && <button onClick={onRetry}>Retry</button>}
    </div>
  );
}
