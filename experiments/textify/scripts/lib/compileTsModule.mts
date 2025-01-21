import ts from "typescript";
import path from "path";

export const compileTsModule = (tsCode: string) => {
  const tsConfigPath = "./tsconfig.json";
  // Find the nearest tsconfig.json
  const configPath = ts.findConfigFile(
    path.dirname(tsConfigPath),
    ts.sys.fileExists,
    path.basename(tsConfigPath),
  );

  if (!configPath) {
    throw new Error(
      `Could not find a valid tsconfig.json at path: ${tsConfigPath}`,
    );
  }

  // Read and parse tsconfig.json
  const configFile = ts.readConfigFile(configPath, ts.sys.readFile);
  if (configFile.error) {
    throw new Error(
      `Error reading tsconfig.json: ${ts.formatDiagnostic(
        configFile.error,
        ts.createCompilerHost({}),
      )}`,
    );
  }

  const parsedConfig = ts.parseJsonConfigFileContent(
    configFile.config,
    ts.sys,
    path.dirname(configPath),
  );

  const compilerOptions = parsedConfig.options;

  // Transpile the TypeScript code using the compiler options
  const output = ts.transpileModule(tsCode, {
    compilerOptions,
    reportDiagnostics: true,
  });

  if (output.diagnostics && output.diagnostics.length) {
    const diagnosticMessages = output.diagnostics.map((diagnostic) =>
      ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"),
    );
    throw new Error(
      `TypeScript Compilation Errors:\n${diagnosticMessages.join("\n")}`,
    );
  }

  return output.outputText; // Compiled JavaScript code
};
