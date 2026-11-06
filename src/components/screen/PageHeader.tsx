import type { ReactNode } from "react";

export function PageHeader({
  eyebrow,
  title,
  meta,
}: {
  eyebrow: string;
  title: string;
  meta?: ReactNode;
}) {
  return (
    <header className="rise-in mb-10 border-b border-hairline pb-6 md:mb-14">
      <p className="eyebrow mb-3">{eyebrow}</p>
      <div className="grid min-w-0 gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <h1 className="display-title min-w-0 text-4xl text-platinum sm:text-5xl md:text-6xl">{title}</h1>
        {meta && <div className="min-w-0 font-mono text-xs text-muted-foreground">{meta}</div>}
      </div>
    </header>
  );
}
