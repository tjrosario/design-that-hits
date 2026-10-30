import { defineConfig } from "vitest/config";

/**
 * Tests cover the logic that has actually broken, not coverage for its own sake.
 *
 * Until this existed the whole gate on a change was "it compiles and Vercel served a
 * 200", and six real defects passed it: pages rendering the wrong grid, sitemap URLs
 * returning 404, a snippet cut to 75 characters, a bot trap that would have discarded
 * real messages. Each file here is a bug that already happened.
 *
 * `SHOP_DISABLE_RSS` keeps the catalog deterministic: without it the suite would reach
 * out to Etsy's feed and the numbers would move under it.
 */
export default defineConfig({
  // Resolves the @/* aliases from tsconfig; Vite does this natively now.
  resolve: { tsconfigPaths: true },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    /*
      `TZ` is pinned so the suite sees a runtime zone that is not the shop's. Unpinned, a
      dev machine on US Eastern makes the shop-timezone tests vacuous, because the runtime
      zone and the shop zone agree and dropping the zone entirely still passes.
    */
    env: { SHOP_DISABLE_RSS: "1", TZ: "UTC" },
  },
});
