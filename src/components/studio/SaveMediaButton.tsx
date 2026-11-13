"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

const subscribeNoop = () => () => {};

/**
 * iPhone and iPad, where the share sheet offers "Save Image" or "Save Video".
 *
 * Desktop and Android can share files too but have nowhere to save them to, so they keep
 * the plain download. iPads report a Mac user agent, hence the touch-point check.
 */
const canSaveToPhotos = () => {
  try {
    const ios =
      /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    return ios && !!navigator.canShare?.({ files: [new File([""], "x.png", { type: "image/png" })] });
  } catch {
    return false;
  }
};

/** Past the video route's own 60-second limit, so a stuck render fails here rather than hanging. */
const TIMEOUT = 70_000;
/** A file that took longer than this waits for a fresh tap, since iOS only shares inside a recent one. */
const TAP_WINDOW = 4_000;

type Status = "idle" | "loading" | "ready" | "stale" | "failed";

/** Resolves once the tab is in view, so a retry does not start while iOS has it paused. */
const visible = () =>
  document.visibilityState === "visible"
    ? Promise.resolve()
    : new Promise<void>((done) =>
        document.addEventListener("visibilitychange", function on() {
          if (document.visibilityState !== "visible") return;
          document.removeEventListener("visibilitychange", on);
          done();
        })
      );

async function fetchFile(href: string, filename: string, type: string) {
  const response = await fetch(href, { signal: AbortSignal.timeout?.(TIMEOUT) });
  // A 404 means the card changed since this page loaded, so the file no longer matches its caption.
  if (!response.ok) throw new Error(response.status === 404 ? "stale" : "failed");
  return new File([await response.blob()], filename, { type });
}

/**
 * A save button that shows its progress.
 *
 * The share sheet on iOS so the file can reach Photos, a download everywhere else. A
 * dropped connection retries once with the tab in view, by which point the render is
 * usually cached; a failure is not kept, so the next tap starts clean.
 */
export function SaveMediaButton({
  href,
  filename,
  label,
  primary,
}: {
  href: string;
  filename: string;
  label: string;
  primary?: boolean;
}) {
  const sharable = useSyncExternalStore(subscribeNoop, canSaveToPhotos, () => false);
  const file = useRef<Promise<File> | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [seconds, setSeconds] = useState(0);
  const video = filename.endsWith(".mp4");

  // Counts up while a video renders, so a long wait reads as progress rather than a hang.
  useEffect(() => {
    if (status !== "loading" || !video) return;
    const started = Date.now();
    const tick = setInterval(() => setSeconds(Math.floor((Date.now() - started) / 1000)), 1000);
    return () => {
      clearInterval(tick);
      setSeconds(0);
    };
  }, [status, video]);

  const load = () => {
    const type = video ? "video/mp4" : "image/png";
    file.current ??= fetchFile(href, filename, type).catch(async (error) => {
      // Only a dropped connection is worth retrying; a bad status would only fail again.
      if (!(error instanceof TypeError)) throw error;
      await visible();
      return fetchFile(href, filename, type);
    });
    file.current.catch(() => (file.current = null));
    return file.current;
  };

  const share = async (media: File) => {
    // Freed while the sheet is open, so a sheet that never reports back cannot leave it stuck.
    setStatus("idle");
    try {
      await navigator.share({ files: [media] });
    } catch (error) {
      // iOS refuses once the tap has expired, and the loaded file makes a second tap work.
      const name = error instanceof DOMException ? error.name : "";
      if (name !== "AbortError") {
        setStatus(name === "NotAllowedError" || name === "InvalidStateError" ? "ready" : "failed");
      }
    }
  };

  const download = (media: File) => {
    const url = URL.createObjectURL(media);
    const link = Object.assign(document.createElement("a"), { href: url, download: filename });
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
    setStatus("idle");
  };

  const save = async () => {
    if (status === "loading") return;
    const started = Date.now();
    setStatus("loading");
    let media: File;
    try {
      media = await load();
    } catch (error) {
      setStatus(error instanceof Error && error.message === "stale" ? "stale" : "failed");
      return;
    }
    if (!sharable) return download(media);
    if (Date.now() - started > TAP_WINDOW) return setStatus("ready");
    await share(media);
  };

  const text = {
    idle: `${sharable ? "Save" : "Download"} ${label}`,
    loading: video ? `Rendering ${label}…` : `Preparing ${label}…`,
    ready: `Ready. Tap to save ${label}`,
    stale: "Card changed. Reload the page",
    failed: "Could not load. Tap to try again",
  }[status];
  const busy = status === "loading";

  return (
    <a
      href={href}
      download={filename}
      role="button"
      // Videos render on demand, so they wait for a real tap rather than starting on every
      // touch while scrolling. Stills are cheap enough to warm up.
      onPointerDown={() => void (sharable && !video && load().catch(() => {}))}
      onClick={(event) => {
        // A modified click keeps the link's own behaviour, such as opening in a new tab.
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        void save();
      }}
      // Space presses a button, which a link does not do on its own.
      onKeyDown={(event) => {
        if (event.key !== " ") return;
        event.preventDefault();
        void save();
      }}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold ${busy ? "cursor-progress" : "cursor-pointer"}`}
      style={
        primary
          ? { background: "var(--gradient-brand)", color: "var(--brand-ink)" }
          : { background: "var(--surface-3)", color: "var(--text)" }
      }
    >
      {busy && (
        <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4 shrink-0 motion-safe:animate-spin">
          <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeOpacity="0.3" strokeWidth="3" />
          <path d="M21 12a9 9 0 0 0-9-9" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        </svg>
      )}
      <span aria-live="polite">{text}</span>
      {/* Outside the live region, so a screen reader does not read out every second. */}
      {busy && video && seconds >= 3 && (
        <span aria-hidden="true" className="tabular-nums">
          {seconds}s
        </span>
      )}
    </a>
  );
}
