import Seat from "./Seat";

export default function SeatMap({ seats, onSeatClick }) {
  return (
    <div
      role="list"
      aria-label="Seat map"
      className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 gap-3"
    >
      {seats.map((seat) => (
        <div role="listitem" key={seat.id}>
          <Seat seat={seat} onClick={onSeatClick} />
        </div>
      ))}
    </div>
  );
}
