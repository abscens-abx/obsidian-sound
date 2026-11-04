export function Wordmark() {
  return (
    <span className="flex items-center gap-2.5" aria-label="LAWLIET">
      <span
        aria-hidden
        className="grid size-6 place-items-center rounded-full border border-silver/70 display-title text-sm leading-none text-platinum"
      >
        L
      </span>
      <span className="font-mono text-sm tracking-[0.32em] text-platinum">LAWLIET</span>
    </span>
  );
}
