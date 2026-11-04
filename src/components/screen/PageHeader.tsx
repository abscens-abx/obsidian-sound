import type { ReactNode } from "react";

export function PageHeader({ eyebrow, title, meta }: { eyebrow: string; title: string; meta?: ReactNode }) {
  return (
    <header className="rise-in mb-10 border-b border-hairline pb-6 md:mb-14">
      <p className="eyebrow mb-3">{eyebrow}</p>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="display-title text-5xl text-platinum md:text-7xl">{title}</h1>
        {meta && <div className="font-mono text-xs text-muted-foreground">{meta}</div>}
      </div>
    </header>
  );
}
