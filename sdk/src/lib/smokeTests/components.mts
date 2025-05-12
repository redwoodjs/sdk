import { join } from "path";
import * as fs from "fs/promises";
import { log } from "./constants.mjs";
import { getSmokeTestFunctionsTemplate } from "./templates/smokeTestFunctions.template";
import { getSmokeTestTemplate } from "./templates/SmokeTest.template";
import { getSmokeTestClientTemplate } from "./templates/SmokeTestClient.template";

/**
 * Creates the smoke test components in the target project directory
 */
export async function createSmokeTestComponents(
  targetDir: string,
  skipClient: boolean = false,
): Promise<void> {
  console.log("Creating smoke test components in project...");

  // Create directories if they don't exist
  const componentsDir = join(targetDir, "src", "app", "components");
  log("Creating components directory: %s", componentsDir);
  await fs.mkdir(componentsDir, { recursive: true });

  // Create __smokeTestFunctions.ts
  const smokeTestFunctionsPath = join(componentsDir, "__smokeTestFunctions.ts");
  log("Creating __smokeTestFunctions.ts at: %s", smokeTestFunctionsPath);
  const smokeTestFunctionsContent = getSmokeTestFunctionsTemplate();

  // Create SmokeTest.tsx with conditional client component import
  const smokeTestPath = join(componentsDir, "__SmokeTest.tsx");
  log("Creating __SmokeTest.tsx at: %s", smokeTestPath);
  const smokeTestContent = getSmokeTestTemplate(skipClient);

  // Write the server files
  log("Writing SmokeTestFunctions file");
  await fs.writeFile(smokeTestFunctionsPath, smokeTestFunctionsContent);
  log("Writing SmokeTest component file");
  await fs.writeFile(smokeTestPath, smokeTestContent);

  // Only create client component if not skipping client-side tests
  if (!skipClient) {
    // Create SmokeTestClient.tsx
    const smokeTestClientPath = join(componentsDir, "__SmokeTestClient.tsx");
    log("Creating __SmokeTestClient.tsx at: %s", smokeTestClientPath);
    const smokeTestClientContent = getSmokeTestClientTemplate();

    log("Writing SmokeTestClient component file");
    await fs.writeFile(smokeTestClientPath, smokeTestClientContent);
    log("Created client-side smoke test component");
  } else {
    log("Skipping client-side smoke test component creation");
  }

  log("Smoke test components created successfully");
  console.log("Created smoke test components:");
  console.log(`- ${smokeTestFunctionsPath}`);
  console.log(`- ${smokeTestPath}`);
  if (!skipClient) {
    console.log(`- ${join(componentsDir, "__SmokeTestClient.tsx")}`);
  } else {
    console.log("- Client component skipped (--skip-client was specified)");
  }
}
