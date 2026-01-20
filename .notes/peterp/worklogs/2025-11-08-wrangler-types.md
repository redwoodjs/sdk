2025-11-08 — Wrangler type generation reminders

Reviewed the request to mention `pnpm generate` wherever the docs tell users to edit `wrangler.jsonc`. Started by running `rg` across `docs/` for `wrangler.jsonc` references and filtered to sections that instruct edits. The relevant pages were `core/database-do`, `core/env-vars`, `core/authentication`, `core/realtime`, `core/cron`, `core/storage`, `core/queues`, and `migrating`.

Added the same reminder sentence after each configuration snippet so the docs now tell readers to run `pnpm generate` after touching `wrangler.jsonc`. Adjusted the queues page twice because the initial patch misplaced a blank line before the reminder.

Finished with a quick read-through of the touched sections to confirm formatting and wording stay consistent.

