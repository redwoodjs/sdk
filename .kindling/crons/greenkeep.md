Run greenkeeping for the Redwood SDK monorepo.

Perform a full dependency maintenance pass:

1. Audit all workspace packages for available updates (`pnpm outdated`) and security advisories (`pnpm audit`).
2. Determine which dependency tiers to update based on the current date:
   - **Tier 1 (Critical)**: Always included (react, vite, wrangler, cloudflare packages, etc.)
   - **Tier 2 (SDK/Starter)**: Include on the 1st and 3rd week of the month
   - **Tier 3 (Infra/Playgrounds)**: Include on the 2nd and 4th week of the month
3. Apply updates: edit package.json files (manifest-first), apply pnpm overrides for transitive advisories, regenerate lockfile.
4. Verify: `pnpm install`, `pnpm audit`, `pnpm --filter rwsdk build`, SDK unit tests.
5. Create a pull request framed as a routine dependency update. No security language in PR title or description.
6. If security advisories were resolved, write an advisory draft to `.notes/advisory-drafts/` for manual review.

Use the `greenkeeping` protocol.
