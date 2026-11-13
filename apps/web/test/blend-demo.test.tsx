import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { toHex } from "@thema/exporters";
import { afterEach, describe, expect, it } from "vitest";
import { BlendDemo, demoSystem, type Owners } from "@/components/blend-demo";
import { heroBlend } from "@/lib/hero-blend";

afterEach(cleanup);

const { sites } = heroBlend();
const START: Owners = { colors: "north", typography: "fieldnotes", shape: "quietbank" };

const chip = (site: string, label: string) =>
  within(screen.getByRole("group", { name: `Borrow from ${site}` })).getByRole("button", {
    name: label,
  });
const designMd = () => screen.getByTestId("demo-design-md").textContent ?? "";
const button = () => screen.getByTestId("demo-primary-button");

describe("the Landing demo: the real blend and fix, in the browser", () => {
  it("starts with one owner per tag and shows the blended system's values", () => {
    render(<BlendDemo sites={sites} />);
    expect(chip("north.example", "Colors").getAttribute("aria-pressed")).toBe("true");
    expect(chip("fieldnotes.example", "Type").getAttribute("aria-pressed")).toBe("true");
    expect(chip("quietbank.example", "Shape").getAttribute("aria-pressed")).toBe("true");
    const { system } = demoSystem(sites, START, { roundness: 0, density: 0 });
    expect(designMd()).toContain(
      `primary: "${toHex(system.color.light.primary)}"  # north.example`,
    );
    expect(designMd()).toContain(`body: ${system.typography.families.sans}  # fieldnotes.example`);
    expect(button().style.borderRadius).toBe(`${system.radius.md}px`);
  });

  it("moving a chip moves the tag, and the DESIGN.md says where it comes from", () => {
    render(<BlendDemo sites={sites} />);
    fireEvent.click(chip("quietbank.example", "Colors"));
    expect(chip("quietbank.example", "Colors").getAttribute("aria-pressed")).toBe("true");
    expect(chip("north.example", "Colors").getAttribute("aria-pressed")).toBe("false");
    const { system } = demoSystem(
      sites,
      { ...START, colors: "quietbank" },
      { roundness: 0, density: 0 },
    );
    expect(designMd()).toContain(
      `primary: "${toHex(system.color.light.primary)}"  # quietbank.example`,
    );
  });

  it("the roundness slider changes the label and the preview button's radius", () => {
    render(<BlendDemo sites={sites} />);
    const before = button().style.borderRadius;
    fireEvent.change(screen.getByLabelText("Roundness"), { target: { value: "-1" } });
    expect(button().style.borderRadius).toBe("0px");
    expect(button().style.borderRadius).not.toBe(before);
    expect(designMd()).toContain("button: 0px");
    fireEvent.change(screen.getByLabelText("Density"), { target: { value: "1" } });
    expect(designMd()).toContain("density: 1.25x");
  });

  it("shows ratios that pass WCAG AA, as the fixer guarantees", () => {
    render(<BlendDemo sites={sites} />);
    for (const owners of [
      START,
      { colors: "quietbank", typography: "north", shape: "fieldnotes" },
    ] as Owners[]) {
      const { system, unresolved } = demoSystem(sites, owners, { roundness: 0.5, density: -0.5 });
      expect(unresolved).toEqual([]);
      expect(system.a11y.passes).toBe(true);
    }
    expect(
      Number.parseFloat(screen.getByTestId("ratio-label").textContent ?? "0"),
    ).toBeGreaterThanOrEqual(4.5);
    expect(
      Number.parseFloat(screen.getByTestId("ratio-ink").textContent ?? "0"),
    ).toBeGreaterThanOrEqual(4.5);
    expect(screen.getByText("AA ✓ all pass")).toBeTruthy();
  });

  it("Reset restores the start, and the same inputs always give the same system", () => {
    render(<BlendDemo sites={sites} />);
    const start = designMd();
    fireEvent.click(chip("fieldnotes.example", "Shape"));
    fireEvent.change(screen.getByLabelText("Roundness"), { target: { value: "0.8" } });
    expect(designMd()).not.toBe(start);
    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    expect(designMd()).toBe(start);
    const settings = { roundness: 0.3, density: 0.2 };
    expect(demoSystem(sites, START, settings)).toEqual(demoSystem(sites, START, settings));
  });
});
