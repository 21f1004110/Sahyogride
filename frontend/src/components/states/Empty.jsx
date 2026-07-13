export default function Empty({ message = "Nothing here yet." }) {
  return (
    <div className="text-center py-10 text-gray-500">
      <p aria-hidden="true" className="text-2xl mb-2">
        🗺️
      </p>
      <p>{message}</p>
    </div>
  );
}
