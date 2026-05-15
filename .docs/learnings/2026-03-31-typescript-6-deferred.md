# TypeScript 6 requires a simultaneous @typescript-eslint v9 + ESLint v9 migration

## Problem

A TypeScript bump to v6 was identified as available but was not applied. Simply upgrading `typescript` to `^6.0.0` in isolation causes build failures due to incompatibilities with the current ESLint 10 / @typescript-eslint v8 setup.

## Finding

TypeScript 6 ships breaking changes that require `@typescript-eslint` v9. That package in turn requires ESLint v9. Migrating ESLint from v10 to v9 involves:

- Replacing `eslint@10` and `eslint-config-standard@17` with their v9-compatible equivalents
- Updating or removing rules that changed behavior between ESLint versions
- Potentially updating other ESLint plugins to their ESLint-v9-compatible releases

This is a multi-day ecosystem migration, not a routine version bump.

## Solution

Leave `typescript` pinned at `^5.9.3`. Re-evaluate at the next greenkeeping pass, or schedule a dedicated migration task that includes the full ESLint 9 upgrade.

## Context

Encountered during the 2026-03-31 greenkeeping pass. Root-level TypeScript is Tier 3 (infra), so this deferral has no impact on SDK consumers. The same consideration applies to any monorepo where `typescript` is near a major version boundary and `@typescript-eslint` is also in use.
