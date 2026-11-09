import { describe, expect, it } from "vitest";
import { analyzeColors } from "../src/colors.js";
import type { StyleSample } from "../src/types.js";
import { distance, sample } from "./helpers.js";

function expectPrimary(samples: StyleSample[], want: string | undefined): void {
  const got = analyzeColors(samples).roles.primary;
  if (want === undefined) {
    expect(got, `expected no primary, got ${got}`).toBeUndefined();
    return;
  }
  expect(got, `expected a primary close to ${want}`).toBeDefined();
  expect(distance(got ?? "", want)).toBeLessThan(1);
}

const page = (bg = "#ffffff"): StyleSample =>
  sample({ tag: "html", role: "container", area: 2_000_000, backgroundColor: bg, y: 0 });
const button = (bg: string, overrides: Partial<StyleSample> = {}): StyleSample =>
  sample({ tag: "button", area: 8000, backgroundColor: bg, color: "#ffffff", ...overrides });
const link = (color: string, overrides: Partial<StyleSample> = {}): StyleSample =>
  sample({ tag: "a", area: 2000, color, ...overrides });

describe("primary: browser-default link colors are ignored", () => {
  it("doesn't let large unstyled card links beat the real CTAs (Stripe)", () => {
    expectPrimary(
      [
        page(),
        ...Array.from({ length: 4 }, () => link("rgb(0, 0, 238)", { area: 100_000 })),
        button("#533afd"),
        button("#533afd"),
        button("#533afd"),
      ],
      "#533afd",
    );
  });

  it("ignores visited purple and the dark-scheme defaults too", () => {
    for (const color of ["rgb(85, 26, 139)", "rgb(158, 158, 255)", "rgb(208, 173, 240)"]) {
      expectPrimary(
        [
          page(),
          ...Array.from({ length: 3 }, () => link(color, { area: 90_000 })),
          button("#16a34a"),
          button("#16a34a"),
          button("#16a34a"),
        ],
        "#16a34a",
      );
    }
  });

  it("gives no primary when the only color is default links", () => {
    expectPrimary(
      [page(), link("rgb(0, 0, 238)"), link("rgb(0, 0, 238)"), link("rgb(0, 0, 238)")],
      undefined,
    );
  });

  it("keeps a styled blue that is merely close to the default", () => {
    // #1a0dab (Google's link blue) is a deliberate style, ΔE ≈ 7 from #0000ee.
    expectPrimary([page(), link("#1a0dab"), link("#1a0dab"), link("#1a0dab")], "#1a0dab");
  });
});

describe("primary: fills drawn behind transparent buttons", () => {
  it("uses fill when the button's own background is transparent (Duolingo ::before)", () => {
    const green = () => button("rgba(0, 0, 0, 0)", { fill: "rgb(88, 204, 2)" });
    expectPrimary([page(), green(), green(), green()], "#58cc02");
  });

  it("prefers the button's own visible background over fill", () => {
    const b = () => button("#2563eb", { fill: "rgb(255, 0, 0)" });
    expectPrimary([page(), b(), b(), b()], "#2563eb");
  });
});

describe("primary: monochrome first screen", () => {
  // Resend: neutral glass CTA in the hero, saturated demo-email buttons further down.
  const resend = (withY: boolean): StyleSample[] => [
    page("#000000"),
    button("rgba(0, 0, 0, 0)", {
      fill: "rgb(20, 20, 20)",
      area: 7000,
      ...(withY ? { y: 400 } : {}),
    }),
    ...Array.from({ length: 3 }, (_, i) =>
      button("rgb(0, 163, 255)", { area: 6000, ...(withY ? { y: 3000 + i * 400 } : {}) }),
    ),
  ];

  it("returns no primary when every first-screen CTA is neutral", () => {
    expectPrimary(resend(true), undefined);
  });

  it("is inactive without position data (older recordings, synthetic fixtures)", () => {
    expectPrimary(resend(false), "rgb(0, 163, 255)");
  });

  it("keeps a saturated first-screen CTA even when larger ones are neutral (Headspace)", () => {
    expectPrimary(
      [
        page(),
        button("rgb(0, 97, 239)", { area: 5900, y: 74 }),
        button("rgb(45, 44, 43)", { area: 9500, y: 458 }),
        button("rgb(45, 44, 43)", { area: 5500, y: 458 }),
        button("rgb(0, 97, 239)", { area: 5900, y: 1600 }),
        button("rgb(0, 97, 239)", { area: 5900, y: 2400 }),
      ],
      "#0061ef",
    );
  });

  it("is inactive when the first screen has only links, no filled CTAs (GOV.UK)", () => {
    const blue = (y: number) => link("rgb(26, 101, 166)", { y });
    expectPrimary([page(), blue(300), blue(340), blue(380), blue(1200)], "#1a65a6");
  });

  it("ignores fills that barely differ from the page, like a light search bar (react.dev)", () => {
    expectPrimary(
      [
        page(),
        // Translucent gray search field across the header: ΔE ≈ 6 from white, not a CTA.
        button("rgba(153, 161, 179, 0.2)", { area: 31_000, y: 12, color: "rgb(153, 161, 179)" }),
        button("rgb(8, 126, 164)", { area: 6900, y: 432 }),
        link("rgb(8, 126, 164)", { y: 2000 }),
        link("rgb(8, 126, 164)", { y: 2400 }),
      ],
      "#087ea4",
    );
  });

  it("ignores tiny filled controls (< 1000 px²) when deciding", () => {
    // A small black icon button is not a CTA; the blue hero button decides.
    expectPrimary(
      [
        page(),
        button("#000000", { area: 900, y: 20 }),
        button("#2563eb", { y: 400 }),
        button("#2563eb", { y: 1400 }),
        button("#2563eb", { y: 2400 }),
      ],
      "#2563eb",
    );
  });
});

describe("primary: first-screen CTAs weigh more", () => {
  it("lets a small hero CTA beat large card links lower down (GitHub)", () => {
    expectPrimary(
      [
        page(),
        button("#08872b", { y: 350 }),
        link("#08872b", { y: 3000 }),
        link("#08872b", { y: 4000 }),
        // Five big violet card links: 255,000 weight vs the green's 36,000 before the boost.
        ...Array.from({ length: 5 }, (_, i) =>
          link("#8534f3", { area: 17_000, y: 2000 + i * 500 }),
        ),
      ],
      "#08872b",
    );
  });

  it("lets a filled hero CTA beat many lighter links (Duolingo GET STARTED)", () => {
    expectPrimary(
      [
        page(),
        button("rgba(0, 0, 0, 0)", { fill: "rgb(88, 204, 2)", area: 16_500, y: 453 }),
        button("rgba(0, 0, 0, 0)", { fill: "rgb(88, 204, 2)", y: 2000 }),
        button("rgba(0, 0, 0, 0)", { fill: "rgb(88, 204, 2)", y: 3000 }),
        ...Array.from({ length: 20 }, (_, i) =>
          link("rgb(165, 237, 110)", { area: 3500, y: 4000 + i * 40 }),
        ),
      ],
      "#58cc02",
    );
  });

  it("doesn't overturn a color used heavily across the page (GOV.UK's link blue)", () => {
    expectPrimary(
      [
        page(),
        ...Array.from({ length: 10 }, (_, i) =>
          link("rgb(26, 101, 166)", { area: 37_000, y: 300 + i * 600 }),
        ),
        button("rgb(15, 122, 82)", { area: 8800, y: 255 }),
        button("rgb(15, 122, 82)", { area: 8800, y: 255 }),
      ],
      "#1a65a6",
    );
  });

  it("ignores a translucent glow: no extra weight, and not a CTA for the monochrome rule", () => {
    const glow = (y: number) => link("#ffffff", { fill: "rgba(2, 252, 239, 0.44)", area: 6000, y });
    // White page: the glow would win with the extra weight; the orange buttons are heavier.
    expectPrimary(
      [
        page(),
        glow(263),
        glow(2000),
        glow(2500),
        ...[3000, 3500, 4000].map((y) => button("#ff6719", { y })),
      ],
      "#ff6719",
    );
    // Black page (Resend): with the glow ignored, the only first-screen CTA is neutral.
    expectPrimary(
      [
        page("#000000"),
        glow(263),
        button("#ffffff", { color: "#000000", area: 7000, y: 400 }),
        ...[6000, 6500, 7000].map((y) => button("rgb(0, 163, 255)", { area: 6000, y })),
      ],
      undefined,
    );
  });

  it("gives no extra weight to large boxes, the second screen, or samples without y", () => {
    const blue = [1000, 1500, 2000].map((y) => button("#2563eb", { y })); // 72,000 weight
    // 40,000 px² is above button size (480 × 80 = 38,400).
    expectPrimary([page(), button("#dc2626", { area: 40_000, y: 100 }), ...blue], "#2563eb");
    expectPrimary([page(), button("#dc2626", { area: 30_000, y: 900 }), ...blue], "#2563eb");
    expectPrimary([page(), button("#dc2626", { area: 30_000 }), ...blue], "#2563eb");
  });
});

describe("primary: only the page's own fonts count", () => {
  // 2,000,000 px² of Inter body text: a family needs 2% of text weight to be a page family.
  const body = (): StyleSample =>
    sample({ tag: "p", role: "body", area: 2_000_000, color: "#111111" });
  const green = () => [0, 1, 2].map(() => button("#16a34a", { area: 2000 })); // 18,000

  it("ignores interactive samples in a font the page doesn't use (Resend's Helvetica demo link)", () => {
    // 36,000 weight of blue, but in Helvetica: 1.75% of text weight, not a page family.
    const demo = () =>
      link("rgb(0, 163, 255)", { area: 4000, fontFamily: "Helvetica, Arial, sans-serif" });
    expectPrimary([page(), body(), demo(), demo(), demo(), ...green()], "#16a34a");
  });

  it("still counts samples whose stack has no readable family (icon-only buttons)", () => {
    const icon = () => button("#dc2626", { fontFamily: '"Material Symbols Outlined"' });
    expectPrimary([page(), body(), icon(), icon(), icon()], "#dc2626");
  });

  it("counts the page's display, heading, mono and serif families", () => {
    const families = {
      display: '"Playfair Display", serif',
      heading: "aBCFavorit, sans-serif",
      mono: '"Geist Mono", monospace',
      serif: '"Source Serif 4", Georgia, serif',
    };
    for (const [slot, fontFamily] of Object.entries(families)) {
      // Make the family a page family: headings for display/heading, body text for serif,
      // code for mono.
      const uses =
        slot === "display"
          ? [sample({ tag: "h1", fontFamily, fontSize: 64, area: 120_000 })]
          : slot === "heading"
            ? [
                sample({ tag: "h1", fontFamily: families.display, fontSize: 64, area: 120_000 }),
                sample({ tag: "h2", fontFamily, fontSize: 40, area: 120_000 }),
              ]
            : slot === "mono"
              ? [sample({ tag: "code", role: "body", fontFamily, area: 5000, inCode: true })]
              : [sample({ tag: "p", role: "body", fontFamily, area: 200_000 })];
      const violet = () => link("#7c3aed", { area: 4000, fontFamily });
      expectPrimary([page(), body(), ...uses, violet(), violet(), violet(), ...green()], "#7c3aed");
    }
  });
});
