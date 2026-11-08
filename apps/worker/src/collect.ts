import type { StyleSample } from "@thema/engine";

export interface CollectOptions {
  /** Keep at most this many samples (the largest by area), in document order. */
  maxSamples: number;
}

/**
 * Collects raw StyleSamples from the current page. Runs INSIDE the browser via page.evaluate,
 * so it must be self-contained: no imports, no references to anything outside this function.
 * It reads computed styles only; deciding what they mean is the engine's job.
 */
export function collectSamples(options: CollectOptions): StyleSample[] {
  const SKIP_TAGS = new Set([
    "script",
    "style",
    "noscript",
    "template",
    "head",
    "meta",
    "link",
    "title",
    "base",
    "br",
    "wbr",
    "option",
    "optgroup",
    "datalist",
    "source",
    "track",
    "param",
  ]);
  const INTERACTIVE_TAGS = new Set(["button", "select", "textarea", "summary"]);
  const INTERACTIVE_ROLES = new Set([
    "button",
    "link",
    "tab",
    "menuitem",
    "menuitemcheckbox",
    "menuitemradio",
    "checkbox",
    "radio",
    "switch",
    "option",
  ]);
  const SIDES = ["top", "right", "bottom", "left"] as const;
  const CORNERS = ["top-left", "top-right", "bottom-right", "bottom-left"] as const;

  const round = (n: number): number => Math.round(n * 100) / 100;
  const px = (value: string): number => {
    const n = Number.parseFloat(value);
    return Number.isFinite(n) ? n : 0;
  };
  const isTransparent = (color: string): boolean =>
    color === "" ||
    color === "transparent" ||
    /^rgba\(.*,\s*0(\.0+)?\)$/.test(color) ||
    /\/\s*0(\.0+)?\)$/.test(color);

  const root = document.documentElement;
  const docWidth = Math.max(root.scrollWidth, root.clientWidth);
  const docHeight = Math.max(root.scrollHeight, root.clientHeight);

  /** The color that actually paints the canvas: html, else body (CSS propagation), else the UA Canvas. */
  const canvasColor = (): string => {
    const htmlBg = getComputedStyle(root).backgroundColor;
    if (!isTransparent(htmlBg)) return htmlBg;
    const bodyBg = document.body ? getComputedStyle(document.body).backgroundColor : "";
    if (!isTransparent(bodyBg)) return bodyBg;
    const probe = document.createElement("div");
    probe.style.backgroundColor = "Canvas";
    root.appendChild(probe);
    const canvas = getComputedStyle(probe).backgroundColor;
    probe.remove();
    return canvas;
  };

  const hasDirectText = (el: Element): boolean =>
    Array.from(el.childNodes).some(
      (n) => n.nodeType === Node.TEXT_NODE && (n.textContent ?? "").trim().length > 0,
    );

  const roleOf = (el: Element, tag: string): NonNullable<StyleSample["role"]> => {
    const aria = (el.getAttribute("role") ?? "").toLowerCase();
    if (/^h[1-6]$/.test(tag) || aria === "heading") return "heading";
    const isInput = tag === "input" && (el as HTMLInputElement).type !== "hidden";
    if (
      (tag === "a" && el.hasAttribute("href")) ||
      INTERACTIVE_TAGS.has(tag) ||
      isInput ||
      INTERACTIVE_ROLES.has(aria)
    ) {
      return "interactive";
    }
    return hasDirectText(el) ? "body" : "container";
  };

  /** The widest visible border side's color, or undefined when no side is drawn. */
  const visibleBorderColor = (cs: CSSStyleDeclaration): string | undefined => {
    let best: { width: number; color: string } | undefined;
    for (const side of SIDES) {
      const width = px(cs.getPropertyValue(`border-${side}-width`));
      const style = cs.getPropertyValue(`border-${side}-style`);
      if (width > 0 && style !== "none" && style !== "hidden" && (!best || width > best.width)) {
        best = { width, color: cs.getPropertyValue(`border-${side}-color`) };
      }
    }
    return best?.color;
  };

  /** Largest corner radius in px; percentages resolve against the smaller box side. */
  const largestRadius = (cs: CSSStyleDeclaration, width: number, height: number): number =>
    Math.max(
      ...CORNERS.map((corner) => {
        const first = cs.getPropertyValue(`border-${corner}-radius`).trim().split(/\s+/)[0] ?? "0";
        return first.endsWith("%") ? (px(first) / 100) * Math.min(width, height) : px(first);
      }),
    );

  const fontWeight = (value: string): number =>
    value === "bold" ? 700 : value === "normal" ? 400 : px(value) || 400;

  const visible = (el: Element): boolean =>
    typeof el.checkVisibility === "function"
      ? el.checkVisibility({ opacityProperty: true, visibilityProperty: true })
      : true;

  const found: { sample: StyleSample; index: number }[] = [];
  const elements = Array.from(document.querySelectorAll("*"));
  elements.forEach((el, index) => {
    const tag = el.tagName.toLowerCase();
    if (SKIP_TAGS.has(tag) || el.closest("svg, math")) return;
    if (el !== root && !visible(el)) return;

    const rect = el.getBoundingClientRect();
    let area: number;
    if (el === root) {
      area = docWidth * docHeight; // the canvas paints the whole document
    } else {
      const left = Math.max(0, rect.left + window.scrollX);
      const top = Math.max(0, rect.top + window.scrollY);
      const right = Math.min(docWidth, rect.right + window.scrollX);
      const bottom = Math.min(docHeight, rect.bottom + window.scrollY);
      area = Math.max(0, right - left) * Math.max(0, bottom - top);
    }
    if (area <= 0) return;

    const cs = getComputedStyle(el);
    const role = roleOf(el, tag);
    const backgroundColor = el === root ? canvasColor() : cs.backgroundColor;
    const borderColor = visibleBorderColor(cs);
    const borderRadius = largestRadius(cs, rect.width, rect.height);
    const boxShadow = cs.boxShadow;
    const hasShadow = boxShadow !== "" && boxShadow !== "none";

    // Skip pure wrappers: nothing visible of their own and no text.
    const hasSignal =
      el === root ||
      el === document.body ||
      role !== "container" ||
      !isTransparent(backgroundColor) ||
      borderColor !== undefined ||
      hasShadow ||
      borderRadius > 0;
    if (!hasSignal) return;

    const fontSize = px(cs.fontSize);
    const display = cs.display;
    const isFlexOrGrid = /flex|grid/.test(display);
    const gap = isFlexOrGrid ? Math.max(px(cs.rowGap), px(cs.columnGap)) : 0;
    const maxWidth = cs.maxWidth.endsWith("px") ? px(cs.maxWidth) : undefined;

    const sample: StyleSample = {
      tag,
      role,
      area: Math.round(area),
      color: cs.color,
      backgroundColor,
      ...(borderColor !== undefined ? { borderColor } : {}),
      fontFamily: cs.fontFamily,
      fontSize: round(fontSize),
      fontWeight: fontWeight(cs.fontWeight),
      lineHeight: round(cs.lineHeight === "normal" ? fontSize * 1.2 : px(cs.lineHeight)),
      letterSpacing: round(cs.letterSpacing === "normal" ? 0 : px(cs.letterSpacing)),
      padding: [
        round(px(cs.paddingTop)),
        round(px(cs.paddingRight)),
        round(px(cs.paddingBottom)),
        round(px(cs.paddingLeft)),
      ],
      margin: [
        round(px(cs.marginTop)),
        round(px(cs.marginRight)),
        round(px(cs.marginBottom)),
        round(px(cs.marginLeft)),
      ],
      ...(gap > 0 ? { gap: round(gap) } : {}),
      borderRadius: round(borderRadius),
      ...(hasShadow ? { boxShadow } : {}),
      ...(maxWidth !== undefined ? { maxWidth: round(maxWidth) } : {}),
    };
    found.push({ sample, index });
  });

  if (found.length <= options.maxSamples) return found.map((f) => f.sample);
  // Too many: keep the largest, then restore document order.
  return [...found]
    .sort((a, b) => b.sample.area - a.sample.area || a.index - b.index)
    .slice(0, options.maxSamples)
    .sort((a, b) => a.index - b.index)
    .map((f) => f.sample);
}
