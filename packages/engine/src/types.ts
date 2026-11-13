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
    // display: the face of the largest headings; heading: a second headings-only face, if any.
    families: { sans: string; serif?: string; mono?: string; display?: string; heading?: string };
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
  pair: [ColorRole, ColorRole]; // [foreground, background]
  theme: "light" | "dark";
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
  /**
   * Effective opacity including ancestors, 0–1; omitted when 1. Computed colors ignore CSS
   * opacity, so the engine folds this into each color's alpha.
   */
  opacity?: number;
  /**
   * Interactive elements whose own background is transparent: the color painted behind them by
   * ::before, ::after, a gradient background-image or a child covering the box. Omitted otherwise.
   */
  fill?: string;
  /** Top of the element's box from the top of the document, px. */
  y?: number;
  /** Left of the element's box from the left of the document, px (can be negative). */
  x?: number;
  /** Size of the element's box, px. */
  width?: number;
  height?: number;
  /** The element is, or is inside, h1–h6 or role="heading". Omitted otherwise. */
  inHeading?: boolean;
  /** The element is, or is inside, pre, code, kbd or samp. Omitted otherwise. */
  inCode?: boolean;
  /**
   * The element's class attribute, trimmed and single-spaced, at most 80 characters; omitted when
   * empty. Lets the engine count repeated identical elements once.
   */
  className?: string;
}
