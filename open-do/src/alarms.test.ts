import { expect, test, describe, beforeAll, afterAll } from "vitest";
import { OpenDO, Registry } from "./index.js";
import fs from "node:fs";
import path from "node:path";

const STORAGE_DIR = path.join(process.cwd(), ".test-storage-alarms");

class AlarmDO extends OpenDO {
  async fetch(request: Request) {
    const url = new URL(request.url);
    if (url.pathname === "/set") {
      const delay = Number(url.searchParams.get("delay") || 100);
      await this.storage.setAlarm(Date.now() + delay);
      return new Response("OK");
    }
    if (url.pathname === "/get") {
      const alarm = await this.storage.getAlarm();
      return new Response(String(alarm));
    }
    if (url.pathname === "/count") {
      const count = await this.storage.get("alarmCount") || 0;
      return new Response(String(count));
    }
    return new Response("Not Found", { status: 404 });
  }

  async alarm() {
    const count = (await this.storage.get<number>("alarmCount") || 0) + 1;
    await this.storage.put("alarmCount", count);
    console.log("ALARM TRIGGERED", count);
  }
}

describe("Durable Object Alarms", () => {
  beforeAll(() => {
    if (fs.existsSync(STORAGE_DIR)) {
      fs.rmSync(STORAGE_DIR, { recursive: true });
    }
  });

  test("should trigger alarm and persist results", async () => {
    const registry = new Registry({ storageDir: STORAGE_DIR });
    const id = "alarm-test";
    const myDo = await registry.get(id, AlarmDO);

    await myDo.fetch(new Request("http://localhost/set?delay=100"));
    
    // Check alarm is set
    const resGet = await myDo.fetch(new Request("http://localhost/get"));
    expect(await resGet.text()).not.toBe("null");

    // Wait for alarm to trigger (plus buffer)
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Check alarm count
    const resCount = await myDo.fetch(new Request("http://localhost/count"));
    expect(await resCount.text()).toBe("1");

    // Check alarm is deleted
    const resGetAfter = await myDo.fetch(new Request("http://localhost/get"));
    expect(await resGetAfter.text()).toBe("null");
  });

  test("should persist alarm across process restarts", async () => {
    const id = "alarm-persist";
    
    {
      const registry = new Registry({ storageDir: STORAGE_DIR });
      const myDo = await registry.get(id, AlarmDO);
      await myDo.fetch(new Request("http://localhost/set?delay=5000")); // Set in future
    }

    // "Restart" registry
    {
      const registry = new Registry({ storageDir: STORAGE_DIR });
      const myDo = await registry.get(id, AlarmDO);
      const resGet = await myDo.fetch(new Request("http://localhost/get"));
      expect(await resGet.text()).not.toBe("null");
    }
  });
});
