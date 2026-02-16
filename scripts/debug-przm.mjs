import fs from "fs";
import path from "path";
import { resolveConfig } from "vite";
import { runDirectivesScan } from "../sdk/dist/vite/runDirectivesScan.mjs";

async function run() {
  const przmRoot = "/Users/justin/rw/goprzm/przm";

  if (!fs.existsSync(przmRoot)) {
    console.error(`Error: Przm root not found at ${przmRoot}`);
    return;
  }

  // Set up memory logging on a tick
  let peakHeap = 0;
  const interval = setInterval(() => {
    const memoryUsage = process.memoryUsage();
    const heapUsed = Math.round(memoryUsage.heapUsed / 1024 / 1024);
    if (heapUsed > peakHeap) peakHeap = heapUsed;
    console.log(
      `[MemoryLog] RSS: ${Math.round(memoryUsage.rss / 1024 / 1024)}MB, Heap: ${heapUsed}MB / ${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB (Peak: ${peakHeap}MB)`,
    );
  }, 100);

  try {
    process.env.RW_NO_BLOCKLIST = "1"; // Bypass blocklist

    console.log(`Resolving Vite config for ${przmRoot}...`);
    const rootConfig = await resolveConfig(
      {
        root: przmRoot,
        configFile: path.join(przmRoot, "vite.config.mts"),
      },
      "build",
      "production",
    );

    const clientFiles = new Set();
    const serverFiles = new Set();

    console.log("Starting DirectiveScan on Przm worker entry...");
    await runDirectivesScan({
      rootConfig,
      environments: rootConfig.environments,
      clientFiles,
      serverFiles,
      entries: [path.join(przmRoot, "src/worker.tsx")],
    });

    console.log("\n--- Results ---");
    console.log("Client files discovered:", clientFiles.size);
    console.log("Server files discovered:", serverFiles.size);
    console.log("Peak Heap Usage:", peakHeap, "MB");
  } catch (error) {
    console.error("Scan failed:", error);
  } finally {
    clearInterval(interval);
  }
}

run().catch(console.error);
