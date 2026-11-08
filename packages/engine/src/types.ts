// Mirrors SPEC.md → Data model. Change types here only, and update SPEC.md in the same commit.

// Colors stored as OKLCH strings, e.g. "oklch(0.62 0.19 259)"
export type ColorRole =
  | "canvas"
  | "surface"
  | "surface-raised"
  | "ink"
  | "ink-muted"
  | "hairline"
  | "primary"
  | "primary-ink"
  | "accent"
  | "success"
  | "warning"
  | "danger"
  | "info";

export interface ThemaSystem {
  meta: { name: string; version: string; sources: SourceRef[]; createdAt: string };
  color: { light: Record<ColorRole, string>; dark: Record<ColorRole, string> };
  typography: {
    families: { sans: string; serif?: string; mono?: string; display?: string };
    scale: {
      name: "xs" | "sm" | "base" | "lg" | "xl" | "2xl" | "3xl" | "4xl";
      size: number;
      lineHeight: number;
      weight: number;
      tracking: number;
    }[];
    ratio: number; // e.g. 1.25
  };
  spacing: { base: 4 | 8; scale: number[] }; // px
  radius: { sm: number; md: number; lg: number; full: 9999 };
  shadow: { sm: string; md: string; lg: string };
  layout: { containerMax: number; gutter: number; sectionY: number };
  motion: { durationFast: number; durationBase: number; easing: string };
  voice: { mood: string[]; summary: string }; // LLM-written, e.g. ["calm", "technical"]
  a11y: { fixes: ContrastFix[]; passes: boolean };
  locks: string[]; // token paths, e.g. "color.light.primary"
}

export interface SourceRef {
  url: string;
  borrowed: BorrowTag[];
  screenshot: string;
}
export type BorrowTag = "colors" | "typography" | "spacing" | "shape" | "layout";
export interface ContrastFix {
  pair: [ColorRole, ColorRole];
  before: number;
  after: number;
}

export interface Project {
  id: string;
  ownerId?: string; // anonymous projects have none
  references: Reference[];
  blend: BlendSettings;
  result: ThemaSystem;
  updatedAt: string;
}
export interface Reference {
  id: string;
  url: string;
  status: "queued" | "running" | "done" | "failed";
  borrowed: BorrowTag[];
  extracted?: ThemaSystem;
  error?: string;
}
export interface BlendSettings {
  density: number;
  roundness: number;
  contrast: number;
  warmth: number;
} // each -1..1

/** Raw input from the worker (defined in week 1, refine as needed). */
export interface StyleSample {
  tag: string; // "button", "h1", "a", "div", ...
  role?: "interactive" | "heading" | "body" | "container";
  area: number; // visible px²
  color: string;
  backgroundColor: string;
  borderColor?: string; // computed CSS values
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  lineHeight: number;
  letterSpacing: number;
  padding: [number, number, number, number];
  margin: [number, number, number, number];
  gap?: number;
  borderRadius: number;
  boxShadow?: string;
  maxWidth?: number;
}
