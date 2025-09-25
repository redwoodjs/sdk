# E2E Testing Infrastructure

This document outlines the architecture of the end-to-end (E2E) testing infrastructure for RedwoodSDK. The primary goal of this infrastructure is to provide a fast, reliable, and easy-to-use framework for testing playground applications in both a local development environment and a production-like Cloudflare deployment.

## The Challenges

The E2E test suite faced two major challenges that needed to be addressed to ensure its effectiveness.

### 1. Performance: Slow and Sequential Execution

The initial test harness was designed for simplicity, but it came at a significant performance cost. Each test that needed to run against both the dev server and a deployment would serially perform the following steps:

1.  Set up a new, isolated test environment.
2.  Start the dev server.
3.  Launch a browser and run the test.
4.  Tear down the dev server and browser.
5.  Set up another new, isolated test environment.
6.  Deploy to Cloudflare.
7.  Launch another browser and run the test again.
8.  Tear down the deployment and browser.

This sequential, per-test setup and teardown process, especially the deployment step, was extremely time-consuming and made the test suite slow to run.

### 2. Reliability: Resource Contention and Flakiness

As the test suite grew, running tests concurrently became a necessity. However, this introduced a new set of reliability problems. Multiple test suites, running in parallel, would often try to launch their own browser instances at the same time. This created a race condition for the browser's executable file, resulting in `ETXTBSY` errors and flaky test runs.

## The Solution: A Concurrent, Suite-Level Architecture

The solution is a complete architectural shift from per-test setup to a concurrent, suite-level approach. The expensive setup operations—starting the dev server, deploying to Cloudflare, and launching the browser—are now performed only once per test file, and in parallel.

This new architecture is composed of three key components.

### 1. Concurrent, Suite-Level Resource Provisioning

The core of the new architecture is the `setupPlaygroundEnvironment` function. When called at the top of a test file, its `beforeAll` hook performs the following actions concurrently:

- **Isolated Environments**: It creates two separate, isolated project directories—one for the dev server and one for the deployment—to prevent any potential conflicts.
- **Concurrent Setup**: It uses `Promise.all` to simultaneously start the dev server, run the Cloudflare deployment, and launch a single, shared browser instance.
- **Global State**: The resulting server, deployment, and browser instances are stored in global, suite-level variables, making them instantly available to all tests within that file.

### 2. A Shared Browser Instance with Per-Test Pages

To solve the resource contention issue and further improve performance, the test harness now uses a single, shared browser instance for all tests within a given suite.

- **Global Setup**: A `globalSetup.mts` file, integrated with Vitest's `globalSetup` configuration, is responsible for launching a single Puppeteer browser instance before any tests run. It shares the browser's connection details (its WebSocket endpoint) with all test suites via a temporary file.
- **Per-Test Connection**: The test harness in each suite reads this endpoint and uses `puppeteer.connect()` to connect to the existing browser instance.
- **Test Isolation**: Instead of creating a new browser, each test now creates a new, isolated browser `page`. This is significantly faster and avoids the race condition, while still ensuring that tests do not share state.

### 3. An Abstracted, Concurrent Test Runner

To provide a clean and simple API for writing tests, a generic `createTestRunner` function was introduced. This function abstracts away the complexity of the underlying concurrent architecture.

- **Unified Logic**: It contains the core logic for running a test against a specific environment (`dev` or `deploy`), including handling skipped tests, managing retries, and creating and cleaning up browser pages.
- **Simple API**: It is used to generate the `testDev`, `testDeploy`, and `testDevAndDeploy` functions, which provide a simple, declarative way to write tests that run concurrently against one or both environments.

This new architecture provides a fast, reliable, and scalable foundation for the E2E test suite, allowing for the comprehensive testing of RedwoodSDK's features without the performance and reliability issues of the previous system.
