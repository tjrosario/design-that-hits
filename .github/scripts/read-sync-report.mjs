// Turns the sync report into GitHub Actions step outputs.
// Kept as a file rather than an inline `node -e` so it stays quotable and testable.
import { readFile } from "node:fs/promises";

const path = process.argv[2];
if (!path) {
  console.error("usage: read-sync-report.mjs <report.json>");
  process.exit(1);
}

const r = JSON.parse(await readFile(path, "utf8"));

// `updated` and `upgraded` count real edits to existing listings, so they are worth a
// commit too. Everything else is just the syncedAt timestamp moving.
const changed = r.added + r.updated + r.upgraded > 0;
const summary =
  `${r.added} added, ${r.updated} updated, ${r.upgraded} relinked; ` +
  `catalog ${r.before} -> ${r.after}`;

console.log(`changed=${changed}`);
console.log(`overflow=${Boolean(r.possibleOverflow)}`);
console.log(`summary=${summary}`);
