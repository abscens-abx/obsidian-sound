import { createFileRoute } from "@tanstack/react-router";
import { getPlatformInfo } from "@/core/platform/capabilities";
import { PageHeader } from "@/components/screen/PageHeader";
import { pageHead } from "@/lib/seo";

export const Route = createFileRoute("/settings")({
  head: () => pageHead("Settings", "Device capabilities and privacy for your local player."),
  component: Settings,
});

function Settings() {
  const info = getPlatformInfo();
  return (
    <>
      <PageHeader eyebrow="Preferences" title="Settings" meta={info.runtime === "web-preview" ? "Web preview" : "Android"} />

      <section aria-labelledby="cap-h" className="mb-14">
        <h2 id="cap-h" className="eyebrow mb-4">
          Device capabilities
        </h2>
        <ul className="divide-y divide-hairline border-y border-hairline">
          {info.capabilities.map((c) => (
            <li key={c.key} className="flex items-center justify-between gap-4 py-4">
              <div>
                <p className="text-sm text-platinum">{c.label}</p>
                <p className="font-mono text-[0.6875rem] text-muted-foreground">{c.requires}</p>
              </div>
              <span className={`eyebrow ${c.available ? "text-platinum" : ""}`}>{c.available ? "Available" : "Not in preview"}</span>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="priv-h" className="max-w-xl">
        <h2 id="priv-h" className="eyebrow mb-4">
          Privacy
        </h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Your library lives on this device. There is no account, and audio files are never uploaded. Optional sync may come
          later and will always be opt-in.
        </p>
      </section>
    </>
  );
}
