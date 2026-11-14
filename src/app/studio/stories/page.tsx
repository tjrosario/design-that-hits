/**
 * Private posting view: ready-to-post images, videos and captions.
 *
 * Unlisted for the same reasons /studio is, and under it so there is one private path
 * rather than two. `noindex, nofollow`, out of the sitemap, linked from nowhere, and
 * deliberately absent from robots.txt, because a Disallow line is a public index of the
 * paths a site wants hidden. It renders only the public catalog, so it is unlisted rather
 * than authenticated; that stops being enough the moment anything private goes on it.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { StoryCardView, type VersionView } from "@/components/studio/StoryCardView";
import {
  STORY_FORMATS,
  animatable,
  storyCards,
  storyVersion,
  videoVersion,
  type StoryCard,
  type StoryFormat,
} from "@/lib/story";

/*
  An hour. The cards come from the catalog, which the sync workflow commits every six
  hours, and every image URL carries a hash of the card it was built from, so a page held
  longer than the catalog would hand out URLs the routes now refuse.
*/
export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Stories",
  robots: { index: false, follow: false },
};

/** The files one version offers, each at the exact URL its route will serve. */
function mediaFor(card: StoryCard, n: number) {
  const query = `id=${card.id}&n=${n + 1}`;
  const stem = `design-that-hits-${card.id}-${n + 1}`;

  const images = (Object.keys(STORY_FORMATS) as StoryFormat[]).map((format) => ({
    label: STORY_FORMATS[format].label,
    href: `/studio/stories/image?${query}&format=${format}&v=${storyVersion(card, n, format)}`,
    filename: `${stem}-${format}.png`,
    primary: format === "story",
  }));

  // Only the full-bleed layouts animate, so the button is absent rather than broken.
  if (!animatable(card, n)) return images;
  return [
    ...images,
    {
      label: "animated story (MP4)",
      href: `/studio/stories/video?${query}&v=${videoVersion(card, n)}`,
      filename: `${stem}-story.mp4`,
    },
  ];
}

function viewsFor(card: StoryCard): VersionView[] {
  return card.versions.map((version, n) => ({
    eyebrow: version.eyebrow,
    alt: `${version.eyebrow}: ${version.title}`,
    preview: `/studio/stories/image?id=${card.id}&n=${n + 1}&format=square&v=${storyVersion(card, n, "square")}`,
    media: mediaFor(card, n),
    captions: version.captions,
  }));
}

export default async function StoriesPage() {
  const cards = await storyCards();

  return (
    <div className="mx-auto max-w-screen-xl px-4 sm:px-5 py-8 sm:py-12">
      <header className="mb-10">
        <p className="eyebrow mb-3">For posting</p>
        <h1 className="display-title mb-3" style={{ fontSize: "clamp(1.9rem, 5vw, 2.8rem)" }}>
          Stories to post
        </h1>
        <p
          className="text-sm sm:text-base leading-relaxed max-w-2xl"
          style={{ color: "var(--text-soft)" }}
        >
          Built from the catalog: the occasions whose shopping window is open first, then
          whatever arrived recently. Each design comes in a few versions, which are the same
          product said a different way, so one design can go out more than once without
          repeating itself. Save the square for a feed post and the story for TikTok, Reels
          or Stories, then copy the caption for the platform you are posting to. Versions whose
          photo fills the frame also offer an animated story, which takes a few seconds to
          render the first time. Planning lives on{" "}
          <Link href="/studio" className="underline" style={{ color: "var(--brand)" }}>
            the studio page
          </Link>
          .
        </p>
      </header>

      {cards.length === 0 ? (
        <p style={{ color: "var(--text-muted)" }}>
          Nothing in season and nothing new in the last 45 days, so there is nothing to post
          from the catalog right now.
        </p>
      ) : (
        <ul className="grid gap-8 sm:gap-10 md:grid-cols-2 lg:grid-cols-3">
          {cards.map((card) => (
            <li
              key={card.id}
              className="flex flex-col rounded-2xl p-5"
              style={{ background: "var(--surface)", border: "1px solid var(--border-soft)" }}
            >
              <StoryCardView title={card.title} reason={card.reason} versions={viewsFor(card)} />
              <Link
                href={`/designs/${card.id}`}
                className="mt-5 text-xs font-semibold uppercase tracking-wider"
                style={{ color: "var(--text-muted)" }}
              >
                Open the product page
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
