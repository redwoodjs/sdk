// @ts-ignore
globalThis.process = { env: {} };

import { beforeAll, beforeEach } from "vitest";
import { cleanup } from "vitest-plugin-rsc/testing-library";
import { msw } from "./test/msw";
import { initialize } from "vitest-plugin-rsc/testing-library";

beforeAll(async () => {
  await msw.start({ quiet: true, onUnhandledRequest: "bypass" });
  initialize();
});

beforeEach(async () => {
  msw.resetHandlers();
  await cleanup();
});