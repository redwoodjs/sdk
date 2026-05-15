import { describe, expect, it, vi } from "vitest";
import {
  classifyModule,
  resolveModuleWithEnvironment,
} from "./runDirectivesScan.mjs";

describe("runDirectivesScan helpers", () => {
  describe("resolveModuleWithEnvironment", () => {
    it("should use the client resolver when importerEnv is 'client'", async () => {
      const clientResolver = vi.fn((_a, _b, _c, _d, cb) =>
        cb(null, "/resolved/client"),
      );
      const workerResolver = vi.fn();

      const result = await resolveModuleWithEnvironment({
        path: "test-path",
        importerEnv: "client",
        clientResolver,
        workerResolver,
      });

      expect(clientResolver).toHaveBeenCalled();
      expect(workerResolver).not.toHaveBeenCalled();
      expect(result).toEqual({ id: "/resolved/client" });
    });

    it("should use the worker resolver when importerEnv is 'worker'", async () => {
      const clientResolver = vi.fn();
      const workerResolver = vi.fn((_a, _b, _c, _d, cb) =>
        cb(null, "/resolved/worker"),
      );

      const result = await resolveModuleWithEnvironment({
        path: "test-path",
        importerEnv: "worker",
        clientResolver,
        workerResolver,
      });

      expect(workerResolver).toHaveBeenCalled();
      expect(clientResolver).not.toHaveBeenCalled();
      expect(result).toEqual({ id: "/resolved/worker" });
    });

    it("should return null on resolution error", async () => {
      const clientResolver = vi.fn((_a, _b, _c, _d, cb) =>
        cb(new Error("Resolution failed")),
      );
      const workerResolver = vi.fn();

      const result = await resolveModuleWithEnvironment({
        path: "test-path",
        importerEnv: "client",
        clientResolver,
        workerResolver,
      });

      expect(result).toBeNull();
    });
  });

  describe("classifyModule", () => {
    it("should return 'client' if 'use client' directive is present", () => {
      const contents = `'use client';\nconsole.log('hello');`;
      const result = classifyModule({ contents, inheritedEnv: "worker" });
      expect(result.moduleEnv).toBe("client");
      expect(result.isClient).toBe(true);
      expect(result.isServer).toBe(false);
    });

    it("should return 'worker' if 'use server' directive is present", () => {
      const contents = `"use server";\nexport default () => {};`;
      const result = classifyModule({ contents, inheritedEnv: "client" });
      expect(result.moduleEnv).toBe("worker");
      expect(result.isClient).toBe(false);
      expect(result.isServer).toBe(true);
    });

    it("should prioritize 'use client' over 'use server'", () => {
      const contents = `'use client';\n'use server';\nconsole.log('hello');`;
      const result = classifyModule({ contents, inheritedEnv: "worker" });
      expect(result.moduleEnv).toBe("client");
      expect(result.isClient).toBe(true);
      expect(result.isServer).toBe(false);
    });

    it("should return the inherited environment if no directive is present", () => {
      const contents = `console.log('no directive');`;
      const result = classifyModule({ contents, inheritedEnv: "worker" });
      expect(result.moduleEnv).toBe("worker");
      expect(result.isClient).toBe(false);
      expect(result.isServer).toBe(false);
    });
  });
});
