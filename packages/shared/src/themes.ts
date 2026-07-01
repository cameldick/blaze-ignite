/**
 * Overlay themes. Kept tiny and shared so the dashboard preview and the live
 * overlay render identically. Add palettes here, not in component code.
 */
export interface OverlayTheme {
  id: string;
  name: string;
  /** CSS color tokens consumed by overlay components. */
  bg: string;
  surface: string;
  accent: string;
  accent2: string;
  text: string;
  muted: string;
}

export const THEMES: Record<string, OverlayTheme> = {
  "ignite-dark": {
    id: "ignite-dark",
    name: "Ignite Dark",
    bg: "transparent",
    surface: "rgba(18, 18, 22, 0.92)",
    accent: "#ff5a1f",
    accent2: "#ffb020",
    text: "#ffffff",
    muted: "#a1a1aa",
  },
  "ember": {
    id: "ember",
    name: "Ember",
    bg: "transparent",
    surface: "rgba(28, 12, 8, 0.92)",
    accent: "#ff3b30",
    accent2: "#ff8a00",
    text: "#fff7ed",
    muted: "#d6a08a",
  },
  "chain-blue": {
    id: "chain-blue",
    name: "Chain Blue",
    bg: "transparent",
    surface: "rgba(8, 14, 28, 0.92)",
    accent: "#3b82f6",
    accent2: "#22d3ee",
    text: "#eff6ff",
    muted: "#93c5fd",
  },
};

export const DEFAULT_THEME = "ignite-dark";
