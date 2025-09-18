import path from "node:path";
import { fileURLToPath } from "node:url";
import { runDirectivesScan } from "../src/vite/runDirectivesScan.mjs";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const projectRoot = path.resolve(__dirname, "../../.."); // Assumes script is in sdk/scripts

async function main() {
  // Mimic the config that the smoke test would have
  const mockRootConfig = {
    root: projectRoot,
    // Add other necessary mock config properties here if needed
  };

  const clientFiles = new Set<string>();
  const serverFiles = new Set<string>();

  try {
    console.log("Starting standalone directive scan...");
    await runDirectivesScan({
      rootConfig: mockRootConfig as any,
      entries: ["./src/client.tsx", "./src/worker.tsx"],
      clientFiles,
      serverFiles,
    });
    console.log("Standalone directive scan completed successfully.");
    console.log("Client files:", Array.from(clientFiles));
    console.log("Server files:", Array.from(serverFiles));
  } catch (e) {
    console.error("Standalone directive scan failed:", e);
    process.exit(1);
  }
}

main();
