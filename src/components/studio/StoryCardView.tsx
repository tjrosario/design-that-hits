"use client";

import { useState } from "react";
import { CaptionTabs } from "@/components/studio/CaptionTabs";
import { SaveMediaButton } from "@/components/studio/SaveMediaButton";
import type { Caption, Platform } from "@/lib/story";

export interface MediaLink {
  label: string;
  href: string;
  filename: string;
  /** The story PNG, which is the one most posts start from. */
  primary?: boolean;
}

export interface VersionView {
  eyebrow: string;
  alt: string;
  /** The square preview, which loads far faster than the story. */
  preview: string;
  media: MediaLink[];
  captions: Record<Platform, Caption>;
}

/**
 * One design's card: a preview, the files to save and the captions to paste.
 *
 * Versions are the same design said a different way, so switching between them is the
 * way to post the same product twice without repeating the post.
 */
export function StoryCardView({
  title,
  reason,
  versions,
}: {
  title: string;
  reason: string;
  versions: VersionView[];
}) {
  const [at, setAt] = useState(0);
  const version = versions[at];

  return (
    <div className="flex flex-col">
      <p
        className="mb-3 inline-flex self-start rounded-full px-3 py-1 text-[0.65rem] font-bold uppercase tracking-[0.18em]"
        style={{ background: "var(--gradient-brand)", color: "var(--brand-ink)" }}
      >
        {reason}
      </p>

      <h2 className="text-base font-semibold leading-snug" style={{ color: "var(--text)" }}>
        {title}
      </h2>

      {/* eslint-disable-next-line @next/next/no-img-element -- a generated PNG, not a catalog photo */}
      <img
        src={version.preview}
        alt={version.alt}
        width={1080}
        height={1080}
        loading="lazy"
        decoding="async"
        className="mt-4 w-full rounded-xl"
        style={{ border: "1px solid var(--border-soft)", background: "var(--bg)" }}
      />

      {versions.length > 1 && (
        <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label={`Version of ${title}`}>
          {versions.map((v, i) => (
            <button
              key={v.eyebrow + i}
              type="button"
              aria-pressed={i === at}
              onClick={() => setAt(i)}
              className="min-h-11 cursor-pointer rounded-full px-4 text-xs font-semibold uppercase tracking-wider transition-colors"
              style={
                i === at
                  ? { background: "var(--gradient-brand)", color: "var(--brand-ink)" }
                  : { border: "1px solid var(--border)", color: "var(--text-soft)" }
              }
            >
              {v.eyebrow}
            </button>
          ))}
        </div>
      )}

      <div className="mt-4 flex flex-col gap-2">
        {version.media.map((media) => (
          <SaveMediaButton
            key={media.href}
            href={media.href}
            filename={media.filename}
            label={media.label}
            primary={media.primary}
          />
        ))}
      </div>

      <CaptionTabs captions={version.captions} title={title} />
    </div>
  );
}
