import { expect, test } from "vitest";
import { vitestInvoke } from "../entries/test";
import { handleVitestRequest } from "../entries/worker";

test("rwsdk-community exports exist", () => {
    expect(vitestInvoke).toBeDefined();
    expect(typeof vitestInvoke).toBe("function");

    expect(handleVitestRequest).toBeDefined();
    expect(typeof handleVitestRequest).toBe("function");
});
