"use client";

import { checkUrl, normalizeUrl } from "@thema/url-guard";
import { useRouter } from "next/navigation";
import { useId, useState, type FormEvent } from "react";
import { buttonVariants } from "@/components/button";
import { cn } from "@/lib/cn";

export { normalizeUrl };

/** The URL to extract, or the reason it can't be: the same network-free rules the worker applies. */
export function validateUrl(
  input: string,
): { ok: true; url: string } | { ok: false; message: string } {
  if (input.trim() === "") return { ok: false, message: "Paste a website address." };
  const result = checkUrl(normalizeUrl(input));
  if (!result.ok) return { ok: false, message: friendly(result.reason) };
  return { ok: true, url: result.url.href };
}

/** The guard's reasons, in words for people. */
function friendly(reason: string): string {
  if (reason.startsWith("Not a valid URL")) return "That doesn't look like a website address.";
  if (reason.startsWith("Only http")) return "Only http and https websites can be extracted.";
  if (reason.includes("credentials")) return "Remove the username and password from the address.";
  return "Only public websites can be extracted, not local or private addresses.";
}

/** The hero's URL pill: input and Extract button inside one pill (DESIGN.md → input). */
export function UrlInput({
  placeholder = "Paste a site, e.g. example.com",
}: {
  placeholder?: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const id = useId();
  const errorId = `${id}-error`;

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = new FormData(event.currentTarget).get("url");
    const result = validateUrl(typeof value === "string" ? value : "");
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setError(null);
    router.push(`/workspace?url=${encodeURIComponent(result.url)}`);
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex max-w-[540px] flex-col gap-2">
      <div className="flex flex-wrap gap-2.5 rounded-full border border-hairline bg-surface p-1.5">
        <label htmlFor={id} className="sr-only">
          Website URL to extract
        </label>
        <input
          id={id}
          name="url"
          type="text"
          inputMode="url"
          autoComplete="url"
          placeholder={placeholder}
          aria-invalid={error !== null}
          aria-describedby={error ? errorId : undefined}
          className="min-w-0 flex-[1_1_240px] border-0 bg-transparent px-4.5 py-3 text-body-md font-body-md text-ink placeholder:text-ink-muted"
        />
        <button type="submit" className={cn(buttonVariants({ variant: "primary" }))}>
          Extract
        </button>
      </div>
      {error && (
        <p id={errorId} role="alert" className="m-0 px-4 text-ui-sm font-ui-sm text-danger">
          {error}
        </p>
      )}
    </form>
  );
}
