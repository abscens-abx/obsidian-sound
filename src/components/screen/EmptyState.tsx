import type { ReactNode } from "react";

/**
 * Deliberate empty state. `note` explains *why* an action is not available
 * rather than presenting a button that does nothing.
 */
export function EmptyState({
  title,
  body,
  note,
  children,
}: {
  title: string;
  body: string;
  note?: string;
  children?: ReactNode;
}) {
  return (
    <section className="rise-in grid gap-8 py-6 sm:grid-cols-[9rem_1fr] sm:items-center md:gap-12">
      <div aria-hidden className="art-void aspect-square w-28 rounded-md sm:w-36" />
      <div className="max-w-md">
        <h2 className="display-title text-3xl text-platinum md:text-4xl">{title}</h2>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{body}</p>
        {children && <div className="mt-6">{children}</div>}
        {note && (
          <p className="mt-6 border-l border-silver/40 pl-3 font-mono text-[0.6875rem] leading-relaxed text-muted-foreground">
            {note}
          </p>
        )}
      </div>
    </section>
  );
}

export const NATIVE_IMPORT_NOTE =
  "Adding music needs Android MediaStore scanning and the system folder picker. Neither is built yet, and neither can run in the web preview.";
