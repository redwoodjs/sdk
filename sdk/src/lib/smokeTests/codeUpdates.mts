import { join } from "path";
import * as fs from "fs/promises";
import { log } from "./constants.mjs";
import { getSmokeTestFunctionsTemplate } from "./templates/smokeTestFunctions.template";
import { getSmokeTestTemplate } from "./templates/SmokeTest.template";
import { getSmokeTestClientTemplate } from "./templates/SmokeTestClient.template";
import { getSmokeTestUrlStylesCssTemplate } from "./templates/smokeTestUrlStyles.css.template";
import { getSmokeTestClientStylesCssTemplate } from "./templates/smokeTestClientStyles.module.css.template";
import MagicString from "magic-string";
import { parse as parseJsonc } from "jsonc-parser";

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

  // Create smoke test stylesheet files
  await createSmokeTestStylesheets(targetDir, "blue");

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

  // Modify worker.tsx and wrangler.jsonc for realtime support
  await modifyAppForRealtime(targetDir);

  log("Smoke test components created successfully");
  console.log("Created smoke test components:");
  console.log(`- ${smokeTestFunctionsPath}`);
  console.log(`- ${smokeTestPath}`);
  if (!skipClient) {
    console.log(`- ${join(componentsDir, "__SmokeTestClient.tsx")}`);
    console.log(
      `- ${join(componentsDir, "smoke_tests_client_styles.module.css")}`,
    );
  } else {
    console.log("- Client component skipped (--skip-client was specified)");
  }
  console.log(
    `- ${join(targetDir, "src", "app", "smoke_tests_url_styles.css")}`,
  );
}

export async function createSmokeTestStylesheets(
  targetDir: string,
  clientStyle: "blue" | "green",
  urlStyle: "red" | "green" = "red",
) {
  log("Creating smoke test stylesheets in project...");

  // Create directories if they don't exist
  const componentsDir = join(targetDir, "src", "app", "components");
  const appDir = join(targetDir, "src", "app");
  await fs.mkdir(componentsDir, { recursive: true });
  await fs.mkdir(appDir, { recursive: true });

  // Create smoke_tests_client_styles.module.css
  const clientStylesPath = join(
    componentsDir,
    "smoke_tests_client_styles.module.css",
  );
  log("Creating smoke_tests_client_styles.module.css at: %s", clientStylesPath);
  const clientStylesContent = getSmokeTestClientStylesCssTemplate(clientStyle);
  await fs.writeFile(clientStylesPath, clientStylesContent);

  // Create smoke_tests_url_styles.css
  const urlStylesPath = join(appDir, "smoke_tests_url_styles.css");
  log("Creating smoke_tests_url_styles.css at: %s", urlStylesPath);
  const urlStylesContent = getSmokeTestUrlStylesCssTemplate(urlStyle);
  await fs.writeFile(urlStylesPath, urlStylesContent);

  log("Smoke test stylesheets created successfully");
}

/**
 * Modifies the worker.tsx and wrangler.jsonc files to add realtime support
 */
export async function modifyAppForRealtime(targetDir: string): Promise<void> {
  log("Modifying worker.tsx and wrangler.jsonc for realtime support");

  // Modify worker.tsx
  const workerPath = join(targetDir, "src", "worker.tsx");

  if (
    await fs
      .access(workerPath)
      .then(() => true)
      .catch(() => false)
  ) {
    log("Found worker.tsx, checking for realtime code");
    const workerContent = await fs.readFile(workerPath, "utf-8");

    // Check if the realtime export line already exists
    const hasRealtimeExport = workerContent.includes(
      'export { RealtimeDurableObject } from "rwsdk/realtime/durableObject"',
    );
    const hasRealtimeRoute = workerContent.includes("realtimeRoute(");
    const hasEnvImport = workerContent.includes(
      'import { env } from "cloudflare:workers"',
    );

    if (!hasRealtimeExport || !hasRealtimeRoute || !hasEnvImport) {
      log("Need to modify worker.tsx for realtime support");
      const s = new MagicString(workerContent);

      // Add the export line if it doesn't exist
      if (!hasRealtimeExport) {
        const importRegex = /import.*?from.*?;\n/g;
        let lastImportMatch;
        let lastImportPosition = 0;

        // Find the position after the last import statement
        while ((lastImportMatch = importRegex.exec(workerContent)) !== null) {
          lastImportPosition =
            lastImportMatch.index + lastImportMatch[0].length;
        }

        if (lastImportPosition > 0) {
          s.appendRight(
            lastImportPosition,
            'export { RealtimeDurableObject } from "rwsdk/realtime/durableObject";\n',
          );
          log("Added RealtimeDurableObject export");
        }
      }

      // Add the env import if it doesn't exist
      if (!hasEnvImport) {
        const importRegex = /import.*?from.*?;\n/g;
        let firstImportMatch = importRegex.exec(workerContent);

        if (firstImportMatch) {
          s.appendLeft(
            firstImportMatch.index,
            'import { env } from "cloudflare:workers";\n',
          );
          log("Added env import from cloudflare:workers");
        }
      }

      // Add the realtimeRoute line if it doesn't exist
      if (!hasRealtimeRoute) {
        const defineAppMatch = workerContent.match(
          /export default defineApp\(\[/,
        );
        if (defineAppMatch && defineAppMatch.index !== undefined) {
          const insertPosition =
            defineAppMatch.index + defineAppMatch[0].length;
          s.appendRight(
            insertPosition,
            "\n  realtimeRoute(() => env.REALTIME_DURABLE_OBJECT),",
          );
          log("Added realtimeRoute to defineApp");
        }
      }

      // Import realtimeRoute if it's not already imported
      if (!workerContent.includes("realtimeRoute")) {
        // First check if we already have the import from rwsdk/realtime/worker
        const realtimeImportMatch = workerContent.match(
          /import.*?from "rwsdk\/realtime\/worker";/,
        );

        if (realtimeImportMatch) {
          // If we have the import but not the specific function, add it
          if (!realtimeImportMatch[0].includes("realtimeRoute")) {
            s.replace(
              realtimeImportMatch[0],
              realtimeImportMatch[0].replace(
                /import (.*?) from "rwsdk\/realtime\/worker";/,
                (match, imports) => {
                  if (imports.includes("{") && imports.includes("}")) {
                    // It's a named import
                    return imports.includes("realtimeRoute")
                      ? match
                      : match.replace(/\{ (.*?) \}/, `{ realtimeRoute, $1 }`);
                  } else {
                    // It's a default import or something else
                    return `import { realtimeRoute } from "rwsdk/realtime/worker";${match}`;
                  }
                },
              ),
            );
          }
        } else {
          // We don't have the rwsdk/realtime/worker import at all, add it
          const importRegex = /import.*?from.*?;\n/g;
          let lastImportMatch;
          let lastImportPosition = 0;

          // Find the position after the last import statement
          while ((lastImportMatch = importRegex.exec(workerContent)) !== null) {
            lastImportPosition =
              lastImportMatch.index + lastImportMatch[0].length;
          }

          if (lastImportPosition > 0) {
            s.appendRight(
              lastImportPosition,
              'import { realtimeRoute } from "rwsdk/realtime/worker";\n',
            );
            log("Added realtimeRoute import from rwsdk/realtime/worker");
          }
        }
      }

      // Write the modified file
      await fs.writeFile(workerPath, s.toString(), "utf-8");
      log("Successfully modified worker.tsx");
    } else {
      log("worker.tsx already has realtime support, no changes needed");
    }
  } else {
    log("worker.tsx not found, skipping modification");
  }

  // Modify wrangler.jsonc
  const wranglerPath = join(targetDir, "wrangler.jsonc");

  if (
    await fs
      .access(wranglerPath)
      .then(() => true)
      .catch(() => false)
  ) {
    log("Found wrangler.jsonc, checking for realtime durable objects");
    const wranglerContent = await fs.readFile(wranglerPath, "utf-8");
    const wranglerConfig = parseJsonc(wranglerContent);

    let modified = false;

    // Check if REALTIME_DURABLE_OBJECT already exists in durable_objects bindings
    const hasDurableObjectBinding =
      wranglerConfig.durable_objects?.bindings?.some(
        (binding: any) => binding.name === "REALTIME_DURABLE_OBJECT",
      );

    // Check if RealtimeDurableObject is already in migrations
    const hasMigration = wranglerConfig.migrations?.some((migration: any) =>
      migration.new_sqlite_classes?.includes("RealtimeDurableObject"),
    );

    if (!hasDurableObjectBinding || !hasMigration) {
      log("Need to modify wrangler.jsonc for realtime support");

      // Create a deep copy of the config to make modifications
      const newConfig = JSON.parse(JSON.stringify(wranglerConfig));

      // Add durable objects binding if needed
      if (!hasDurableObjectBinding) {
        if (!newConfig.durable_objects) {
          newConfig.durable_objects = {};
        }

        if (!newConfig.durable_objects.bindings) {
          newConfig.durable_objects.bindings = [];
        }

        newConfig.durable_objects.bindings.push({
          name: "REALTIME_DURABLE_OBJECT",
          class_name: "RealtimeDurableObject",
        });

        modified = true;
        log("Added REALTIME_DURABLE_OBJECT to durable_objects bindings");
      }

      // Add migration if needed
      if (!hasMigration) {
        if (!newConfig.migrations) {
          newConfig.migrations = [
            {
              tag: "v1",
              new_sqlite_classes: ["RealtimeDurableObject"],
            },
          ];
          modified = true;
          log("Added new migrations with RealtimeDurableObject");
        } else if (newConfig.migrations.length > 0) {
          // Add RealtimeDurableObject to the first migration's sqlite classes
          const firstMigration = newConfig.migrations[0];

          if (!firstMigration.new_sqlite_classes) {
            firstMigration.new_sqlite_classes = ["RealtimeDurableObject"];
          } else if (
            !firstMigration.new_sqlite_classes.includes("RealtimeDurableObject")
          ) {
            firstMigration.new_sqlite_classes.push("RealtimeDurableObject");
          }

          modified = true;
          log("Added RealtimeDurableObject to existing migration");
        }
      }

      if (modified) {
        // Write the modified config back to the file
        await fs.writeFile(
          wranglerPath,
          JSON.stringify(newConfig, null, 2),
          "utf-8",
        );
        log("Successfully modified wrangler.jsonc");
      }
    } else {
      log("wrangler.jsonc already has realtime support, no changes needed");
    }
  } else {
    log("wrangler.jsonc not found, skipping modification");
  }
}
