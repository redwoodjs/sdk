---
title: Scaling Durable Objects with the Host Process Model
date: 2026-02-03 13:12
author: peterp
---

# Scaling Durable Objects with the Host Process Model

## Summary
We refactored the Durable Object runtime to support a multi-process architecture on a single machine. This involves a **Coordinator** that manages a pool of **Host Processes**, communicating over Unix Domain Sockets (UDS). We also renamed "Worker" to "Host Process" to distinguish our implementation from Cloudflare Workers.

## The Problem
The previous architecture was monolithic (in-process). To improve fault isolation, concurrency, and memory management, we needed to move the Durable Object execution into separate child processes. Additionally, the term "Worker" was causing confusion with Cloudflare's own Workers, so we opted for "Host Process."

## Investigation & Timeline
* **Initial State:** 
    * Single-process `Registry` managing `InstanceContainer`.
    * No process sharding.
* **Attempts:**
    * **Step 1: UDS Transport.** Implemented `transport.ts` for cross-runtime (Node/Bun) UDS communication.
    * **Step 2: Process Management.** Refactored `Registry` into `ClusterCoordinator` to spawn and monitor child processes.
    * **Step 3: terminology Refactor.** Renamed `workerCount` to `hostCount` and moved `src/worker` to `src/host`.
    * **Step 4: Serve API.** Created a Cloudflare-compatible `serve()` helper to simplify setup.

## Discovery & Key Findings
* **Fault Isolation:** Crashing a Durable Object in one Host Process doesn't bring down the main Gateway or other objects.
* **Hashing for Placement:** Using a simple hash of the Object ID allows the Coordinator to consistently route requests to the same host process without a complex lookup table.
* **UDS Performance:** Unix Domain Sockets provide a low-latency bridge between the Gateway and the Hosts, essential for maintaining the performance expectations of Durable Objects.

## Resolution
The final solution includes:
1.  `ClusterCoordinator`: The brain that manages hosts and location logic.
2.  `Host Process`: A pool of sharded processes that run `src/host/process.ts`.
3.  `RemoteStub`: A proxy that serializes requests and sends them over UDS.
4.  Revised documentation in `docs/host-process-model.md` and a clean `serve()` API.

## Next Steps
- [ ] Implement Node.js adapter for `serve()` (currently biased towards `Bun.serve`).
- [ ] Fix `list.test.ts` range/reverse bugs.
- [ ] Add automatic process restarting for crashed Hosts.
