import { Lang, parse } from "@ast-grep/napi";
import baseDebug from "debug";
import enhancedResolve from "enhanced-resolve";
import { readFile, writeFile } from "fs/promises";
import path, { resolve } from "path";
import tmp from "tmp-promise";
import { createServer as createViteServer } from "vite";
import { unstable_readConfig } from "wrangler";

import { findWranglerConfig } from "../lib/findWranglerConfig.mjs";
import { redwood } from "../vite/index.mjs";

const debug = baseDebug("rwsdk:worker-run");

export const runWorkerScript = async (relativeScriptPath: string) => {
  if (!relativeScriptPath) {
    console.error("Error: Script path is required");
    console.log("\nUsage:");
    console.log("  npm run worker:run <script-path>");
    console.log("\nOptions:");
    console.log(
      "  RWSDK_WRANGLER_CONFIG      Environment variable for config path",
    );
    console.log("\nExamples:");
    console.log("  npm run worker:run src/scripts/seed.ts");
    console.log(
      "  RWSDK_WRANGLER_CONFIG=custom.toml npm run worker:run src/scripts/seed.ts\n",
    );
    process.exit(1);
  }

  const scriptPath = resolve(process.cwd(), relativeScriptPath);
  debug("Running worker script: %s", scriptPath);

  const workerConfigPath = process.env.RWSDK_WRANGLER_CONFIG
    ? resolve(process.cwd(), process.env.RWSDK_WRANGLER_CONFIG)
    : await findWranglerConfig(process.cwd());
  debug("Using wrangler config: %s", workerConfigPath);

  const workerConfig = unstable_readConfig({
    config: workerConfigPath,
    env: "dev",
  });

  const durableObjectsToExport =
    workerConfig.durable_objects?.bindings
      .filter((binding) => !binding.script_name)
      .map((binding) => binding.class_name) ?? [];

  const workerEntryRelativePath = workerConfig.main;

  const workerEntryPath =
    workerEntryRelativePath ?? path.join(process.cwd(), "src/worker.tsx");

  const durableObjectExports = [];
  if (durableObjectsToExport.length > 0) {
    const resolver = enhancedResolve.create.sync({
      extensions: [".mts", ".ts", ".tsx", ".mjs", ".js", ".jsx", ".json"],
    });

    const workerEntryContents = await readFile(workerEntryPath, "utf-8");
    const workerEntryAst = parse(Lang.Tsx, workerEntryContents);
    const exportDeclarations = [
      ...workerEntryAst.root().findAll('export { $$$EXPORTS } from "$MODULE"'),
      ...workerEntryAst.root().findAll("export { $$$EXPORTS } from '$MODULE'"),
      ...workerEntryAst.root().findAll("export { $$$EXPORTS } from '$MODULE'"),
    ];

    for (const exportDeclaration of exportDeclarations) {
      const moduleMatch = exportDeclaration.getMatch("MODULE");
      const exportsMatch = exportDeclaration.getMultipleMatches("EXPORTS");

      if (!moduleMatch || exportsMatch.length === 0) {
        continue;
      }

      const modulePath = moduleMatch.text();
      const specifiers = exportsMatch.map((m) => m.text().trim());

      for (const specifier of specifiers) {
        if (durableObjectsToExport.includes(specifier)) {
          const resolvedPath = resolver(
            path.dirname(workerEntryPath),
            modulePath,
          );
          durableObjectExports.push(
            `export { ${specifier} } from "${resolvedPath}";`,
          );
        }
      }
    }
  }

  const tmpDir = await tmp.dir({
    prefix: "rw-worker-run-",
    unsafeCleanup: true,
  });

  const relativeTmpWorkerEntryPath = "worker.tsx";
  const tmpWorkerPath = path.join(tmpDir.path, "wrangler.json");
  const tmpWorkerEntryPath = path.join(tmpDir.path, relativeTmpWorkerEntryPath);

  const scriptWorkerConfig = {
    ...workerConfig,
    configPath: tmpWorkerPath,
    userConfigPath: tmpWorkerPath,
    main: relativeTmpWorkerEntryPath,
  };

  try {
    await writeFile(tmpWorkerPath, JSON.stringify(scriptWorkerConfig, null, 2));
    await writeFile(
      tmpWorkerEntryPath,
      `
${durableObjectExports.join("\n")}
export { default } from "${scriptPath}";
`,
    );

    debug("Worker config written to: %s", tmpWorkerPath);
    debug("Worker entry written to: %s", tmpWorkerEntryPath);

    process.env.RWSDK_WORKER_RUN = "1";

    const server = await createViteServer({
      configFile: false,
      plugins: [
        redwood({
          configPath: tmpWorkerPath,
          includeCloudflarePlugin: true,
          entry: {
            worker: tmpWorkerEntryPath,
          },
        }),
      ],
      server: {
        port: 0,
      },
    });
    debug("Vite server created");

    try {
      await server.listen();
      const address = server.httpServer?.address();
      debug("Server listening on address: %o", address);

      if (!address || typeof address === "string") {
        throw new Error("Dev server address is invalid");
      }

      debug("Fetching worker...");
      await fetch(`http://localhost:${address.port}/`);
      debug("Worker fetched successfully");
    } finally {
      debug("Closing server...");
      server.close();
      debug("Server closed");
    }
  } finally {
    debug("Closing inspector servers...");
    debug("Temporary files cleaned up");
  }

  // todo(justinvdm, 01 Apr 2025): Investigate what handles are remaining open
  process.exit(0);
};

if (import.meta.url === new URL(process.argv[1], import.meta.url).href) {
  runWorkerScript(process.argv[2]);
}
