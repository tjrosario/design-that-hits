"use client";

import { useState } from "react";

/** Copies text to the clipboard and says so for a moment. */
export function CopyButton({
  text,
  label,
  accessibleName,
}: {
  text: string;
  label: string;
  accessibleName: string;
}) {
  const [status, setStatus] = useState<"idle" | "copied" | "failed">("idle");

  return (
    <button
      type="button"
      aria-label={status === "idle" ? accessibleName : undefined}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setStatus("copied");
        } catch {
          setStatus("failed");
        }
        setTimeout(() => setStatus("idle"), 2500);
      }}
      /* btn-outline is the site's own secondary button, so this matches it rather than
         inventing a third treatment in one corner of one page. */
      className="btn-outline min-h-11 cursor-pointer text-sm"
    >
      <span aria-live="polite">
        {status === "copied"
          ? "Copied"
          : status === "failed"
            ? "Could not copy; select the text instead"
            : label}
      </span>
    </button>
  );
}
