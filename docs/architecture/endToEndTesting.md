# E2E Testing Infrastructure

This document outlines the architecture of the end-to-end (E2E) testing infrastructure for RedwoodSDK. The goal of this infrastructure is to provide a fast, reliable, and easy-to-use framework for testing playground applications in both a local development environment and a production-like Cloudflare deployment.

## The Challenges

The E2E test suite faced two major challenges that needed to be addressed to ensure its effectiveness.

### 1. Performance: Slow and Sequential Execution

The initial test harness was designed for simplicity, but it came at a performance cost. Each test that needed to run against both the dev server and a deployment would serially perform the following steps:

1.  Set up an isolated test environment.
2.  Start the dev server.
3.  Launch a browser and run the test.
4.  Tear down the dev server and browser.
5.  Set up another isolated test environment.
6.  Deploy to Cloudflare.
7.  Launch another browser and run the test again.
8.  Tear down the deployment and browser.

This sequential, per-test setup and teardown process, especially the deployment step, was time-consuming and made the test suite slow to run. Furthermore, the setup for both dev and deploy environments had to complete before *any* tests could run, creating a bottleneck.

### 2. Reliability: Resource Contention and Flakiness

As the test suite grew, running tests concurrently became a necessity. However, this introduced reliability problems. Multiple test suites, running in parallel, would often try to launch their own browser instances at the same time. This created a race condition for the browser's executable file, resulting in `ETXTBSY` errors and flaky test runs.

## The Solution: A Concurrent, Suite-Level Architecture

The architecture shifts from per-test setup to a concurrent, suite-level approach. The expensive setup operations—starting the dev server, deploying to Cloudflare, and launching the browser—are now performed only once per test file, and in parallel.

This architecture is composed of three key components.

### 1. Decoupled, Concurrent Resource Provisioning

The core of the architecture is the `setupPlaygroundEnvironment` function. When called at the top of a test file, its `beforeAll` hook performs the following actions:

- **Isolated Environments**: It creates two separate, isolated project directories—one for the dev server and one for the deployment—to prevent potential conflicts.
- **Concurrent Setup Initiation**: It initiates the dev server startup, the Cloudflare deployment, and the browser launch simultaneously. It does not wait for them to complete.
- **Promise-Based Global State**: Instead of storing the resolved instances, it stores promises for the server, deployment, and browser instances in global, suite-level variables.

This approach allows the setup processes to run in the background without blocking the test runner.

### 2. A Shared Browser Instance with Per-Test Pages

To solve the resource contention issue and further improve performance, the test harness uses a single, shared browser instance for all tests within a given suite.

- **Global Setup**: A `globalSetup.mts` file, integrated with Vitest's `globalSetup` configuration, is responsible for launching a single Puppeteer browser instance before any tests run. It shares the browser's connection details (its WebSocket endpoint) with all test suites via a temporary file.
- **Per-Test Connection**: The test harness in each suite reads this endpoint and uses `puppeteer.connect()` to connect to the existing browser instance.
- **Test Isolation**: Instead of creating a browser, each test now creates a new, isolated browser `page`. This is faster and avoids the race condition, while still ensuring that tests do not share state.

### 3. An Abstracted, Concurrent Test Runner

To provide a clean and simple API for writing tests, a generic `createTestRunner` function was introduced. This function abstracts away the complexity of the underlying concurrent architecture.

- **Pre-Test Resolution**: The test runner uses `describe.concurrent` with a `beforeEach` hook. This hook is responsible for awaiting the specific promise (or promises) required for the test (e.g., it awaits the dev server and browser promises before a `dev` test). This ensures that a test only runs once its required resources are ready, allowing dev and deploy tests to start independently.
- **Unified Logic**: It contains the core logic for running a test against a specific environment (`dev` or `deploy`), including handling skipped tests, managing retries, and creating and cleaning up browser pages.
- **Automatic Retries**: To handle transient failures, the runner automatically retries failed tests. This is governed by a general attempt limit and a stricter, per-error-code limit to prevent endless retries on persistent issues. For nightly builds, these limits are increased to more aggressively detect and report flaky tests.
- **Simple API**: It is used to generate the `testDev`, `testDeploy`, and `testDevAndDeploy` functions, which provide a simple, declarative way to write tests that run concurrently against one or both environments.

### Q: Why not use a more integrated E2E testing framework like Playwright?

Our choice to use a combination of `vitest`, `puppeteer-core`, and custom scripts is a pragmatic one driven by the specific needs of testing a framework rather than a web application.

1.  **Flexibility and Control:** As a framework, we require fine-grained control over the entire testing process, including setting up dev servers, triggering deployments, and programmatically interacting with the browser at a low level. Our custom scripts, built on `puppeteer-core`, provide this flexibility. We started with this approach for our initial smoke tests and extended it for playground E2E tests to reuse battle-tested code.

2.  **Framework-Specific Testing Scenarios:** Our testing needs go beyond typical application testing. For instance, we need to test how the framework handles file system changes (e.g., for HMR). More opinionated, all-in-one frameworks like Playwright can sometimes create limitations that make these kinds of tests difficult to implement reliably.

3.  **Lightweight Test Harness:** `vitest` serves as a lightweight test harness on top of our custom infrastructure. It provides the familiar test structure (`test`, `expect`, etc.) without imposing a rigid, opinionated structure that could conflict with our need for orchestration flexibility.

This stack gives us the right balance: the power of low-level browser automation where we need it, and a simple, unopinionated test runner to structure our test suites.

## Test Execution

### Running Tests Locally

To run smoke tests for a starter project, run this from within the `sdk/` dir:
```sh
pnpm smoke-test --path=../starter
```

To run the playground E2E tests:
```
pnpm test:e2e
```
This architecture provides a fast, reliable, and scalable foundation for the E2E test suite, allowing for the comprehensive testing of RedwoodSDK's features without the performance and reliability issues of the previous system.
