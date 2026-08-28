/**
 * Canonical origin for the site. One place to change when a custom domain
 * lands: set `NEXT_PUBLIC_SITE_URL`. On Vercel, previews and production both
 * fall back to the production domain via `VERCEL_PROJECT_PRODUCTION_URL`, so
 * canonical URLs stay correct on preview deploys.
 */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "https://usesavora.vercel.app")
).replace(/\/+$/, "");

export const SITE_NAME = "Savora";

/** ~117 chars — social previews truncate near 125, search near 155. */
export const SITE_DESCRIPTION =
  "A non-custodial ajo savings circle on Solana: fixed rounds, one member collects per rotation, nobody holds the money.";
