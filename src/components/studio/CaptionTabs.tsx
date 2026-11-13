"use client";

import { useId, useRef, useState } from "react";
import { CopyButton } from "@/components/studio/CopyButton";
import { platforms, TIKTOK_TITLE_MAX, type Caption, type Platform } from "@/lib/story";

const NAMES: Record<Platform, string> = { tiktok: "TikTok", instagram: "Instagram" };

function Field({
  heading,
  value,
  copy,
  title,
  platform,
  mono,
}: {
  heading: string;
  value: string;
  copy: string;
  title: string;
  platform: Platform;
  mono?: boolean;
}) {
  return (
    <div className="mt-4">
      <p
        className="text-[0.65rem] font-bold uppercase tracking-[0.18em]"
        style={{ color: "var(--text-muted)" }}
      >
        {heading}
      </p>
      <p
        className={`mt-1 text-sm leading-relaxed ${mono ? "break-all" : ""}`}
        style={{ color: "var(--text-soft)" }}
      >
        {value}
      </p>
      <div className="mt-2">
        <CopyButton
          key={value}
          text={value}
          label={copy}
          accessibleName={`${copy} for ${title} (${NAMES[platform]})`}
        />
      </div>
    </div>
  );
}

/** One tab per platform, each with the caption that platform takes. Arrow keys move between them. */
export function CaptionTabs({
  captions,
  title,
}: {
  captions: Record<Platform, Caption>;
  title: string;
}) {
  const [active, setActive] = useState<Platform>(platforms[0]);
  const id = useId();
  const tabs = useRef<Partial<Record<Platform, HTMLButtonElement | null>>>({});

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    const step = { ArrowRight: 1, ArrowLeft: -1 }[event.key];
    const edge = { Home: 0, End: platforms.length - 1 }[event.key];
    if (step === undefined && edge === undefined) return;
    event.preventDefault();
    const next =
      platforms[edge ?? (platforms.indexOf(active) + step! + platforms.length) % platforms.length];
    setActive(next);
    tabs.current[next]?.focus();
  };

  return (
    <div className="mt-5">
      <div
        role="tablist"
        aria-label={`Caption platform for ${title}`}
        className="flex gap-1 rounded-full p-1"
        style={{ background: "var(--bg)" }}
        onKeyDown={onKeyDown}
      >
        {platforms.map((p) => (
          <button
            key={p}
            ref={(el) => {
              tabs.current[p] = el;
            }}
            type="button"
            role="tab"
            id={`${id}-tab-${p}`}
            aria-selected={active === p}
            aria-controls={`${id}-panel-${p}`}
            tabIndex={active === p ? 0 : -1}
            onClick={() => setActive(p)}
            className="min-h-11 flex-1 cursor-pointer rounded-full px-3 text-sm font-semibold transition-colors"
            style={
              active === p
                ? { background: "var(--gradient-brand)", color: "var(--brand-ink)" }
                : { color: "var(--text-muted)" }
            }
          >
            {NAMES[p]}
          </button>
        ))}
      </div>

      {platforms.map((p) => {
        const caption = captions[p];
        const body = `${caption.text}\n\n${caption.hashtags.join(" ")}`;
        return (
          <div
            key={p}
            role="tabpanel"
            id={`${id}-panel-${p}`}
            aria-labelledby={`${id}-tab-${p}`}
            hidden={active !== p}
            tabIndex={0}
          >
            {caption.title && (
              <Field
                heading={`Title (max ${TIKTOK_TITLE_MAX})`}
                value={caption.title.slice(0, TIKTOK_TITLE_MAX)}
                copy="Copy title"
                title={title}
                platform={p}
              />
            )}
            <div className="mt-4">
              <p
                className="text-[0.65rem] font-bold uppercase tracking-[0.18em]"
                style={{ color: "var(--text-muted)" }}
              >
                {caption.title ? "Description" : "Caption"}
              </p>
              <p className="mt-1 text-sm leading-relaxed" style={{ color: "var(--text-soft)" }}>
                {caption.text}
              </p>
              <p className="mt-2 text-sm font-semibold" style={{ color: "var(--brand)" }}>
                {caption.hashtags.join(" ")}
              </p>
              <div className="mt-2">
                <CopyButton
                  key={body}
                  text={body}
                  label="Copy caption and tags"
                  accessibleName={`Copy caption and tags for ${title} (${NAMES[p]})`}
                />
              </div>
            </div>
            {caption.cta && (
              <Field
                heading="Link sticker: call to action"
                value={caption.cta}
                copy="Copy call to action"
                title={title}
                platform={p}
              />
            )}
            {caption.link && (
              <Field
                heading="Link sticker: link"
                value={caption.link}
                copy="Copy link"
                title={title}
                platform={p}
                mono
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
