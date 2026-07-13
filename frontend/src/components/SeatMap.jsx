import Seat from "./Seat";

export default function SeatMap({ seats }) {
  return (
    <div
      role="list"
      aria-label="Seat map"
      className="grid grid-cols-4 sm:grid-cols-6 gap-2"
    >
      {seats.map((seat) => (
        <div role="listitem" key={seat.id}>
          <Seat seat={seat} />
        </div>
      ))}
    </div>
  );
}
