import { useId, useState, type FormEvent } from "react";
import { validateUrl } from "@/components/url-input";

/** "Add another site": validated with the shared URL rules before anything is sent. */
export function AddReference({
  onAdd,
  disabled,
  error,
}: {
  /** Resolves when the API accepted the site; rejects with a message for people. */
  onAdd: (url: string) => Promise<void>;
  disabled: boolean;
  /** An error from outside (e.g. the 5-reference cap). */
  error: string | null;
}) {
  const id = useId();
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const shown = message ?? error;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const value = new FormData(form).get("url");
    const result = validateUrl(typeof value === "string" ? value : "");
    if (!result.ok) {
      setMessage(result.message);
      return;
    }
    setBusy(true);
    try {
      await onAdd(result.url);
      setMessage(null);
      form.reset();
    } catch (failure) {
      setMessage(failure instanceof Error ? failure.message : "Couldn't add that site.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={(event) => void onSubmit(event)} noValidate className="flex flex-col gap-1.5">
      <div className="flex gap-2 rounded-lg border border-dashed border-input-border bg-surface p-2">
        <label htmlFor={id} className="sr-only">
          Add a reference URL
        </label>
        <input
          id={id}
          name="url"
          type="text"
          inputMode="url"
          autoComplete="url"
          placeholder={disabled ? "5 of 5 sites added" : "Add another site"}
          disabled={disabled || busy}
          aria-invalid={shown !== null}
          aria-describedby={shown ? `${id}-error` : undefined}
          className="min-w-0 flex-1 border-0 bg-transparent px-2.5 text-body-sm font-body-sm text-ink placeholder:text-ink-subtle"
        />
        <button
          type="submit"
          disabled={disabled || busy}
          className="min-h-11 cursor-pointer rounded-full border-0 bg-ink px-4 text-ui-sm font-ui-sm text-canvas disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? "Adding…" : "Add"}
        </button>
      </div>
      {shown && (
        <p id={`${id}-error`} role="alert" className="m-0 px-2 text-ui-sm font-ui-sm text-danger">
          {shown}
        </p>
      )}
    </form>
  );
}
