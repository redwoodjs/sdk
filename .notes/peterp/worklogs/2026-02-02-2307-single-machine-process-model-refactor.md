---
title: Single Machine Process Model Refactor
date: 2026-02-02 23:07
author: peterp
---

# Single Machine Process Model Refactor

## Summary
Refactored Open Durable Objects to support a Single Machine Process Model. We successfully split the monolithic runtime into distinct `worker` and `durable-object` components and implemented a cross-runtime Unix Domain Socket (UDS) transport layer.

## The Problem
The existing implementation ran all Durable Objects within the same process as the Registry and Router. The goal was to implement a "Single Machine" process model where:
1.  **Registry** acts as a coordinator.
2.  **Worker Processes** host the actual objects.
3.  **Communication** happens via UDS for low latency and security.
4.  Support is preserved for both **Bun** and **Node.js**.

## Investigation & Timeline
*   **Initial State:** `src/registry.ts` managed `InstanceContainer`s directly in memory. All code was in the root `src/` folder.
*   **Attempts:**
    *   **Restructuring:** Moved `OpenDurableObject`, `RpcEnvelope`, and `connection/stub` interfaces to `src/durable-object/` to cleanly separate the User API from the Runtime.
    *   **Extraction:** Extracted `InstanceContainer` and `DurableObjectState` into `src/worker/runtime.ts`. Extracted storage backends to `src/worker/storage.ts`.
    *   **Transport:** Implemented `src/transport.ts` to abstract UDS creation.
        *   *Challenge:* Bun uses `Bun.listen/connect` while Node uses `net`. Created a wrapper interface (`UdsServer`/`UdsSocket`) to unify them.
    *   **Worker Entry Point:** Created `src/worker/process.ts` to serve as the executable for worker processes, handling dynamic class loading and HTTP-over-UDS.
    *   **Verification:** Ran existing tests after every move to ensure no regressions. All tests passed.

## Discovery & Key Findings
*   **Runtime Differences:** Abstracting the socket layer was necessary as Bun's socket API differs significantly from Node's `net.Socket`.
*   **Dynamic Loading:** The Worker Process needs a strategy to load User Code. We implemented a preliminary `--module` and `--class` argument strategy for "lazy loading" code in the worker.

## Resolution
The codebase is now structurally ready for multi-process orchestration. The core components (Runtime, Storage, Transport, Entry Point) exist.

## Next Steps
- [ ] Refactor `Registry` to spawn `worker/process.ts` instead of creating containers locally.
- [ ] Implement the "Placement Logic" in Registry to assign IDs to Workers.
- [ ] Wire up the `Router` to proxy requests via UDS.
- [ ] Add specific tests for the multi-process flow (spawning actual child processes).
