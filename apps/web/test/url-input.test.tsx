import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { normalizeUrl, UrlInput, validateUrl } from "@/components/url-input";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

beforeEach(() => push.mockClear());
afterEach(cleanup);

describe("validateUrl", () => {
  it("accepts public sites, adding https:// to a bare domain", () => {
    expect(normalizeUrl("  stripe.com ")).toBe("https://stripe.com");
    expect(validateUrl("stripe.com")).toEqual({ ok: true, url: "https://stripe.com/" });
    expect(validateUrl("http://example.com/pricing")).toEqual({
      ok: true,
      url: "http://example.com/pricing",
    });
  });

  it.each([
    ["", "Paste a website address."],
    ["not a url at all", "doesn't look like a website address"],
    ["ftp://example.com", "Only http and https"],
    ["javascript:alert(1)", "doesn't look like a website address"],
    ["https://user:pass@example.com", "username and password"],
    ["localhost:3000", "Only public websites"],
    ["http://127.0.0.1", "Only public websites"],
    ["http://192.168.1.1/admin", "Only public websites"],
    ["http://169.254.169.254/latest/meta-data", "Only public websites"],
    ["http://[::1]/", "Only public websites"],
  ])("rejects %j", (input, message) => {
    const result = validateUrl(input);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain(message);
  });
});

describe("UrlInput", () => {
  const submit = (value: string) => {
    render(<UrlInput />);
    fireEvent.change(screen.getByLabelText("Website URL to extract"), { target: { value } });
    fireEvent.click(screen.getByRole("button", { name: "Extract" }));
  };

  it("goes to the workspace with the normalized URL", () => {
    submit("stripe.com");
    expect(push).toHaveBeenCalledWith("/workspace?url=https%3A%2F%2Fstripe.com%2F");
  });

  it("shows the reason, tied to the input, and stays put for a private address", () => {
    submit("http://10.0.0.1");
    expect(push).not.toHaveBeenCalled();
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain("Only public websites");
    const input = screen.getByLabelText("Website URL to extract");
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(input.getAttribute("aria-describedby")).toBe(alert.id);
  });
});
