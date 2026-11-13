import type { ThemaSystem } from "@thema/engine";
import { toShadcnCss, toTailwindCss } from "./css.js";
import { toDesignMd } from "./design-md.js";
import { toDtcg } from "./dtcg.js";
import { toStyleGuide } from "./style-guide.js";

export { SHADCN_VARIABLES, toShadcnCss, toTailwindCss } from "./css.js";
export { toDesignMd } from "./design-md.js";
export { cubicBezier, toDtcg } from "./dtcg.js";
export { cssFontStack, familyForStep, fontStack, toHex } from "./shared.js";
export { toStyleGuide } from "./style-guide.js";

/** Every export format, by file name. Pure: the same system always gives the same files. */
export function exportAll(system: ThemaSystem): Record<string, string> {
  return {
    "DESIGN.md": toDesignMd(system),
    "theme.css": toTailwindCss(system),
    "shadcn.css": toShadcnCss(system),
    "tokens.json": toDtcg(system),
    "style-guide.html": toStyleGuide(system),
  };
}
