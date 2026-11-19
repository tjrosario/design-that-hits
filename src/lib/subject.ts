/**
 * lib/subject.ts
 *
 * What a design is about, matched against its description.
 *
 * This is deliberately not the theme facets in `facets.ts`. Those are built from titles
 * and tags to decide which collection page a product belongs on, and Etsy titles are
 * keyword-stuffed: they file a vintage Vegas casino paper under "retro" because the word
 * "vintage" is in the title. For captions and audio the question is what is actually
 * drawn on the thing, and the description is the only place that is written down.
 *
 * Order is specificity, not alphabet. `golf` sits above `bird` because a birdie is a golf
 * score and the shop's golf shirts say "Birdies & Bourbon" on them. `guinea pig` sits
 * above `dog` and `cat` because a guinea pig design mentions the family dog in passing.
 */

import type { Listing } from "@/types/etsy";

export interface Subject {
  pattern: RegExp;
  /** Carries the subject into a call to action. */
  emoji: string;
  /** Who the design is for, in words that follow "for". */
  who: string;
  /** What to type into a sound search to find audio that fits, most apt first. */
  music: string[];
}

export const SUBJECTS: Subject[] = [
  {
    pattern: /\bgolf|\bgolfer|clubhouse|\bbirdie|\bbogey|\bputting green/i,
    emoji: "\u{26F3}",
    who: "golf lovers",
    music: ["country club jazz", "preppy summer"],
  },
  {
    pattern: /casino|\bpoker\b|slot machine|\bvegas\b|blackjack|roulette|\bdice\b/i,
    emoji: "\u{1F3B0}",
    who: "casino lovers",
    music: ["vegas lounge", "rat pack swing"],
  },
  {
    pattern: /guinea pig|hamster|gerbil|\bferret\b/i,
    emoji: "\u{1F439}",
    who: "small pet owners",
    music: ["cute pet music", "playful ukulele"],
  },
  {
    pattern: /hedgehog/i,
    emoji: "\u{1F994}",
    who: "hedgehog lovers",
    music: ["cute acoustic", "wholesome ukulele"],
  },
  {
    pattern: /dinosaur|\bt-rex\b|\bdino\b/i,
    emoji: "\u{1F995}",
    who: "dinosaur fans",
    music: ["kids adventure music", "playful marching band"],
  },
  {
    pattern: /\bhorses?\b|\bpony\b|equestrian/i,
    emoji: "\u{1F434}",
    who: "horse lovers",
    music: ["country western", "acoustic country"],
  },
  {
    pattern:
      /\bdogs?\b|puppy|puppies|retriever|dachshund|\bpug\b|corgi|husky|collie|terrier|poodle|rottweiler|shih tzu|\bbeagle\b/i,
    emoji: "\u{1F436}",
    who: "dog lovers",
    music: ["happy ukulele", "cute pet music"],
  },
  {
    pattern: /\bcats?\b|kitten|ragdoll|tabby|\bfeline\b/i,
    emoji: "\u{1F431}",
    who: "cat people",
    music: ["playful jazz", "cute pet music"],
  },
  {
    pattern: /woodland|\bdeer\b|reindeer|\bfox\b|squirrel|\bmoose\b|\bbunny\b|\brabbit\b/i,
    emoji: "\u{1F98C}",
    who: "nature lovers",
    music: ["cottagecore folk", "gentle acoustic"],
  },
  {
    pattern: /mushroom|toadstool/i,
    emoji: "\u{1F344}",
    who: "cottagecore souls",
    music: ["cottagecore folk", "forest fairy music"],
  },
  {
    pattern: /\bbirds?\b|cardinal|\bduck|mallard|penguin/i,
    emoji: "\u{1F426}",
    who: "bird lovers",
    music: ["gentle folk", "soft acoustic"],
  },
  {
    pattern: /\bwitch|tarot|crystal ball|\boccult\b|celestial|\bmystic/i,
    emoji: "\u{1F52E}",
    who: "witchy souls",
    music: ["dark witchy", "mystical ambient"],
  },
  {
    pattern: /skull|skeleton|gothic|\bgoth\b|vampire|horror|haunted|\braven\b/i,
    emoji: "\u{1F5A4}",
    who: "the goth at heart",
    music: ["dark alternative", "gothic rock"],
  },
  {
    pattern: /\bdisco\b|disco ball|glitter ball/i,
    emoji: "\u{1FAA9}",
    who: "disco lovers",
    music: ["nu disco", "disco funk"],
  },
  {
    pattern: /cowgirl|cowboy|western|rodeo/i,
    emoji: "\u{1F920}",
    who: "cowgirls and cowboys",
    music: ["country western", "yeehaw remix"],
  },
  {
    pattern: /\bbeach\b|coastal|tropical|\bsurf(ing|er|board)?\b|nautical|\bocean\b|seaside|flamingo/i,
    emoji: "\u{1F30A}",
    who: "beach lovers",
    music: ["tropical house", "surf rock"],
  },
  {
    pattern: /techno|\brave\b|\bdj\b|guitar|vinyl|\bconcert\b|headphone|\bmusic\b/i,
    emoji: "\u{1F3B8}",
    who: "music lovers",
    music: ["melodic techno", "electronic beat"],
  },
  {
    pattern: /cocktail|martini|champagne|prosecco|sangria|bourbon|whiskey|\bbeer\b|\bwine\b|\bpint\b/i,
    emoji: "\u{1F378}",
    who: "cocktail hour",
    music: ["lounge jazz", "cocktail bar jazz"],
  },
  {
    pattern: /\bcoffee\b|espresso|\blatte\b|hot cocoa|hot chocolate/i,
    emoji: "\u{2615}",
    who: "coffee lovers",
    music: ["cozy lofi", "coffee shop jazz"],
  },
  {
    pattern: /gingerbread|\bcookie|\bdonut|cupcake|\bcandy\b|bakery|macaron/i,
    emoji: "\u{1F36A}",
    who: "the sweet-toothed",
    music: ["whimsical baking", "cute jingle"],
  },
  {
    pattern: /\bbaby\b|nursery|newborn|pacifier|teddy bear/i,
    emoji: "\u{1F476}",
    who: "new parents",
    music: ["lullaby", "music box"],
  },
  {
    pattern: /\bwedding\b|bridal|\bbride\b|anniversary/i,
    emoji: "\u{1F48D}",
    who: "the happy couple",
    music: ["romantic piano", "wedding strings"],
  },
  {
    pattern: /\bfloral\b|\bflower|\brose\b|\broses\b|peony|botanical/i,
    emoji: "\u{1F338}",
    who: "flower lovers",
    music: ["soft piano", "dreamy strings"],
  },
];

/** The first subject rule any text matches, in the order declared above. */
export function matchSubject(text: string): Subject | null {
  return SUBJECTS.find((s) => s.pattern.test(text)) ?? null;
}

/** What the design is about, or null when no rule names it. */
export function subjectFor(listing: Listing): Subject | null {
  return matchSubject(`${listing.title} ${listing.description ?? ""}`);
}
