/**
 * eslint.config.mjs
 *
 * ESLint flat config, replacing .eslintrc.json.
 *
 * Next 16 removed the `next lint` command and eslint-config-next@16 requires ESLint 9,
 * which uses flat config. Linting now runs ESLint directly (`npm run lint` → `eslint .`)
 * and this file is the single source of rules. Ruleset is unchanged from the previous
 * `{ "extends": "next/core-web-vitals" }`.
 */

import nextCoreWebVitals from "eslint-config-next/core-web-vitals";

const config = [
  // Flat config has no implicit ignores beyond node_modules, so build output and
  // generated types have to be listed explicitly or ESLint will lint them.
  {
    ignores: [".next/**", "out/**", "build/**", "next-env.d.ts"],
  },
  ...nextCoreWebVitals,
];

export default config;
