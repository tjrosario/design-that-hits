/**
 * lib/description.ts
 *
 * Turns an Etsy description into structured blocks.
 *
 * Etsy stores descriptions as plain text with no markup, but sellers write real structure
 * into them: a heading line, then a run of lines each starting with a bullet marker. A
 * survey of this catalogue found 365 of 366 descriptions shaped that way, with 5,904
 * bullet lines under 109 distinct heading lines.
 *
 * Rendering that as one <p> with `whitespace-pre-line` looks right and reads wrong. A
 * screen reader gets a run-on paragraph peppered with stray hyphens, with no item count,
 * no list navigation and no heading to jump to. Search engines lose the same structure.
 * Parsing it into real <h3> and <ul> elements fixes both at once.
 */

/** Markers sellers actually use in this catalogue: 5,794 "-", 82 "•", 28 "✔". */
const BULLET = /^\s*[-•*‣▪●⁃✓✔]\s+/;

/**
 * Longest line still treated as a heading. The longest real heading in the catalogue is
 * 56 characters; the ceiling keeps a long sentence that happens to sit above a list from
 * being promoted into one.
 */
const MAX_HEADING_CHARS = 80;

export type DescriptionBlock =
  | { kind: "heading"; text: string }
  | { kind: "list"; items: string[] }
  | { kind: "paragraph"; text: string };

export function parseDescription(description: string): DescriptionBlock[] {
  const lines = description.replace(/\r\n/g, "\n").split("\n");
  const blocks: DescriptionBlock[] = [];

  // Lines of the paragraph currently being accumulated, flushed on a blank line or when
  // a list or heading interrupts it.
  let paragraph: string[] = [];
  const flushParagraph = () => {
    if (paragraph.length > 0) {
      blocks.push({ kind: "paragraph", text: paragraph.join("\n") });
      paragraph = [];
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      flushParagraph();
      continue;
    }

    if (BULLET.test(line)) {
      flushParagraph();
      const items: string[] = [];
      while (i < lines.length && BULLET.test(lines[i])) {
        items.push(lines[i].replace(BULLET, "").trim());
        i++;
      }
      i--; // the loop's own i++ consumes the first non-bullet line
      if (items.length > 0) blocks.push({ kind: "list", items });
      continue;
    }

    /*
      Heading test. All three conditions matter:

        - short enough to be a label rather than prose
        - immediately followed by a bullet, so it actually introduces something
        - starts its own block, so the closing sentence of a paragraph that happens to
          run into a list ("…here is what you get:") stays part of that paragraph

      Failing any of them, the line is ordinary prose.
    */
    const next = lines[i + 1];
    const startsBlock = paragraph.length === 0;
    if (
      startsBlock &&
      trimmed.length <= MAX_HEADING_CHARS &&
      next !== undefined &&
      BULLET.test(next)
    ) {
      blocks.push({ kind: "heading", text: trimmed });
      continue;
    }

    paragraph.push(trimmed);
  }

  flushParagraph();
  return blocks;
}
