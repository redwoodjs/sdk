import { setupPlaygroundEnvironment, testDeploy, waitForHydration } from "rwsdk/e2e";
import { expect } from "vitest";

setupPlaygroundEnvironment({
  sourceProjectDir: import.meta.url,
  dev: false,
  deploy: true,
});

testDeploy(
  "rejects stale synced-state websocket sessions",
  async ({ page, url }) => {
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    await waitForHydration(page);

    const result = await page.evaluate(async () => {
      const requestUrl = new URL(
        "/__synced-state/stale-repro",
        window.location.href,
      );
      requestUrl.protocol = requestUrl.protocol === "https:" ? "wss:" : "ws:";
      requestUrl.searchParams.set("__rwsdk_client_version", "stale-build");

      return await new Promise<{
        status: "open" | "error" | "close" | "timeout";
      }>((resolve) => {
        const socket = new WebSocket(requestUrl.toString());
        const timer = window.setTimeout(() => {
          resolve({ status: "timeout" });
          socket.close();
        }, 4000);

        const finish = (status: "open" | "error" | "close") => {
          window.clearTimeout(timer);
          resolve({ status });
        };

        socket.addEventListener("open", () => finish("open"));
        socket.addEventListener("error", () => finish("error"));
        socket.addEventListener("close", () => finish("close"));
      });
    });

    expect(result.status).not.toBe("open");
    expect(result.status).not.toBe("timeout");
  },
);
