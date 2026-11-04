import type { ErrorComponentProps } from "@tanstack/react-router";
import { useRouter } from "@tanstack/react-router";

export function RoutePending() {
  return (
    <div role="status" aria-live="polite" className="space-y-4">
      <span className="sr-only">Loading</span>
      <div className="h-3 w-24 animate-pulse rounded-sm bg-graphite" />
      <div className="h-14 w-64 animate-pulse rounded-sm bg-graphite" />
    </div>
  );
}

export function RouteError({ error, reset }: ErrorComponentProps) {
  const router = useRouter();
  return (
    <div role="alert" className="max-w-md">
      <p className="eyebrow mb-3">Error</p>
      <h1 className="display-title text-4xl text-platinum">This view couldn't load</h1>
      <p className="mt-3 text-sm text-muted-foreground">{error instanceof Error ? error.message : "Unexpected error."}</p>
      <button
        type="button"
        onClick={() => {
          router.invalidate();
          reset();
        }}
        className="mt-6 rounded-md border border-input px-4 py-2 text-sm text-platinum hover:bg-graphite"
      >
        Try again
      </button>
    </div>
  );
}
