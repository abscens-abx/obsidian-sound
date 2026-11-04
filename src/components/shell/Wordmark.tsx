export function Wordmark() {
  return (
    <span className="flex items-center gap-2.5" aria-label="Obsidian">
      <span aria-hidden className="relative block size-5 rounded-full border border-silver/70">
        <span className="absolute inset-[5px] rounded-full bg-platinum" />
      </span>
      <span className="display-title text-2xl text-platinum">Obsidian</span>
    </span>
  );
}
