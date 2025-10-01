# Work Log: Multiple Client Entry Points E2E Test

**Date:** 2025-10-01

## Problem

The framework should support applications that use multiple client entry points (e.g., different `client.tsx` files for different `Document.tsx` shells). However, we currently lack automated end-to-end test coverage to verify this behavior, which makes it harder to guarantee stability.

## Plan

1.  Create a new playground example that is configured with at least two distinct client entry points, each associated with a different page or layout.
2.  Write end-to-end tests for this new playground example.
3.  The tests should confirm that each entry point is correctly bundled, loaded, and hydrated on its respective page, and that they function independently without conflict.
