import { Disc3, Home, ListMusic, Mic2, Music2, Search, Settings, Library, ListOrdered } from "lucide-react";

export const primaryNav = [
  { to: "/", label: "Home", icon: Home },
  { to: "/search", label: "Search", icon: Search },
] as const;

export const libraryNav = [
  { to: "/songs", label: "Songs", icon: Music2 },
  { to: "/albums", label: "Albums", icon: Disc3 },
  { to: "/artists", label: "Artists", icon: Mic2 },
  { to: "/playlists", label: "Playlists", icon: ListMusic },
] as const;

export const utilityNav = [
  { to: "/queue", label: "Queue", icon: ListOrdered },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

/** Mobile bottom bar: four destinations max, thumb-reachable. */
export const mobileNav = [
  { to: "/", label: "Home", icon: Home },
  { to: "/search", label: "Search", icon: Search },
  { to: "/library", label: "Library", icon: Library },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;
