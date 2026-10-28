"use client";

import { useSyncExternalStore } from "react";
import { shippingNotice, type ShippingNotice as Notice } from "@/lib/shipping";

/*
  The notice is read as external state rather than held in component state.

  The clock and localStorage both live outside React, and useSyncExternalStore is how a
  component reads something like that: the server snapshot is empty, so no date is baked
  into a static page, and the real value is read on the client after hydration. Assigning
  it in from an effect is a cascading render and is rejected by react-hooks/set-state-in-effect.
*/

/** `undefined` means not yet computed; `null` means nothing to show. */
let snapshot: Notice | null | undefined;
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | undefined;

/** How often an open tab re-reads the clock, so it cannot outlive its own deadline. */
const REFRESH_MS = 10 * 60 * 1000;

function read(): Notice | null {
  const next = shippingNotice(new Date());
  if (!next) return null;
  try {
    if (localStorage.getItem(storageKey(next)) === "1") return null;
  } catch {
    // Blocked or private storage: show the notice rather than suppress it.
  }
  return next;
}

function getSnapshot(): Notice | null {
  // Cached because getSnapshot runs on every render and has to return the same reference
  // until something changes, or React re-renders forever.
  if (snapshot === undefined) snapshot = read();
  return snapshot;
}

/** Nothing on the server, so the deadline never gets baked into a static page. */
function getServerSnapshot(): Notice | null {
  return null;
}

/** Re-reads the clock, notifying only when the message would actually change. */
function refresh() {
  const next = read();
  const current = snapshot;
  if (current !== undefined && current?.state === next?.state && current?.daysLeft === next?.daysLeft) {
    return;
  }
  snapshot = next;
  for (const listener of listeners) listener();
}

function onVisibilityChange() {
  if (document.visibilityState === "visible") refresh();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  // A tab left open overnight crosses the deadline it is advertising, so the clock is
  // re-read on a timer and whenever the tab is looked at again.
  if (listeners.size === 1) {
    timer = setInterval(refresh, REFRESH_MS);
    document.addEventListener("visibilitychange", onVisibilityChange);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    }
  };
}

function dismiss() {
  const current = getSnapshot();
  if (current) {
    try {
      localStorage.setItem(storageKey(current), "1");
    } catch {
      // Nothing to do: it reappears on the next load, which is the safe failure.
    }
  }
  snapshot = null;
  for (const listener of listeners) listener();
}

/** Keyed by state and date, so a dismissal does not hide the next message too. */
function storageKey(notice: Notice): string {
  return `dth:shipping-notice:${notice.state}:${notice.cutoffLabel}`;
}

/**
 * The Christmas delivery deadline, shown for the three weeks it is worth saying.
 *
 * Fixed to the bottom rather than stacked above the header: an element inserted at the top
 * of the document after hydration pushes the whole page down, which is the layout shift
 * Core Web Vitals measures. Pinned to the viewport it costs no CLS.
 */
export function ShippingNotice() {
  const notice = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  return (
    // The live region is always in the DOM and the text appears inside it, because a screen
    // reader announces changes within an existing region, not the arrival of a new one.
    <div role="status" aria-live="polite">
      {notice && (
        <div
          // Below the filter drawer and the search dropdown, which are both z-50 and must
          // stay on top of this.
          className="fixed inset-x-0 bottom-0 z-30 px-4 py-3 shadow-lg"
          style={{
            backgroundColor: "var(--brand)",
            color: "var(--brand-ink)",
            paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))",
          }}
        >
          <div className="mx-auto flex max-w-screen-xl items-center gap-4">
            <p className="flex-1 text-sm">
              {/* One source for the wording, so the copy cannot drift from the tests. */}
              <strong className="font-semibold">{notice.headline}</strong>{" "}
              <span className="opacity-90">{notice.detail}</span>
            </p>
            <button
              type="button"
              onClick={dismiss}
              aria-label="Dismiss delivery notice"
              className="flex-shrink-0 rounded-full p-1 leading-none opacity-80 transition-opacity hover:opacity-100"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
