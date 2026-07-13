export default function BackgroundBlobs() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="blob-1 absolute -top-32 -left-32 w-96 h-96 rounded-full bg-primary-300/40 blur-3xl" />
      <div className="blob-2 absolute top-1/4 -right-32 w-[28rem] h-[28rem] rounded-full bg-brand-300/30 blur-3xl" />
      <div className="blob-3 absolute bottom-0 left-1/4 w-96 h-96 rounded-full bg-primary-200/30 blur-3xl" />
    </div>
  );
}
