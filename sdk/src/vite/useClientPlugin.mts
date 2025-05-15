import { relative } from "node:path";
import { Plugin } from "vite";
import debug from "debug";
import MagicString from "magic-string";
import { init, parse } from "es-module-lexer";

interface TransformResult {
  code: string;
  map?: any;
}

const log = debug("rwsdk:vite:use-client");

function isJsxFunction(text: string): boolean {
  return (
    text.includes("jsx(") || text.includes("jsxs(") || text.includes("jsxDEV(")
  );
}

/**
 * Transforms a "use client" component file by creating SSR-compatible exports
 * that leverage registerClientReference in the worker runtime
 */
export async function transformClientComponents(
  code: string,
  id: string,
): Promise<TransformResult | undefined> {
  // Skip if not starting with use client directive
  const cleanCode = code.trimStart();
  if (
    !cleanCode.startsWith('"use client"') &&
    !cleanCode.startsWith("'use client'")
  ) {
    log("Skipping file without use client directive:", id);
    return;
  }

  await init;
  const [parsedExports] = parse(code);
  const components: Record<string, string> = {};

  // Process all exports
  for (const exp of parsedExports) {
    const exportName = exp.n;

    // Skip if no name (probably a side effect import)
    if (!exportName) continue;

    // For each export, check if it's a React component
    const exportCode = code.substring(exp.s, exp.e);
    if (isJsxFunction(exportCode)) {
      const ssrName = `${exportName}SSR`;
      components[exportName] = ssrName;
    }
  }

  // Only proceed if we found components
  if (Object.keys(components).length === 0) {
    log("No JSX components found in:", id);
    return;
  }

  // Create transformed code
  const s = new MagicString(code);

  // Remove use client directive
  const directiveMatch = code.match(/^(\s*)(["'])use client\2/);
  if (directiveMatch) {
    const fullDirective = directiveMatch[0];
    const directivePos = code.indexOf(fullDirective);
    const directiveEnd = directivePos + fullDirective.length;
    // If followed by a semicolon, include it in the removal
    if (code[directiveEnd] === ";") {
      s.remove(directivePos, directiveEnd + 1);
    } else {
      s.remove(directivePos, directiveEnd);
    }
  }

  // Add import for registerClientReference
  s.prepend('import { registerClientReference } from "rwsdk/worker";\n');

  // Add component registrations
  let registrations = "\n";
  Object.entries(components).forEach(([name, ssrName]) => {
    registrations += `const ${name} = registerClientReference("${id}", "${name === "default" ? "default" : name}");\n`;
  });

  s.append(registrations);

  // Export all components
  let exportStatements = "\n";
  Object.entries(components).forEach(([name, ssrName]) => {
    if (name === "default") {
      exportStatements += `export { ${name} as default };\n`;
    } else {
      exportStatements += `export { ${name} };\n`;
    }
  });

  s.append(exportStatements);

  return {
    code: s.toString(),
    map: s.generateMap({ hires: true }),
  };
}

export const useClientPlugin = (): Plugin => ({
  name: "rwsdk:use-client",
  async transform(code, id) {
    // Skip if not in worker environment
    if (this.environment.name !== "worker") {
      log("Skipping due to non-worker environment");
      return;
    }

    // Skip node_modules and vite deps
    if (id.includes(".vite/deps") || id.includes("node_modules")) {
      log("Skipping node_modules or .vite/deps file:", id);
      return;
    }

    // Skip files that don't start with use client directive
    if (!code.startsWith('"use client"') && !code.startsWith("'use client'")) {
      log("Skipping file without use client directive:", id);
      return;
    }

    // Remove use client directive using magic-string
    const s = new MagicString(code);
    if (code.startsWith('"use client"')) {
      s.remove(0, '"use client"'.length);
    } else if (code.startsWith("'use client'")) {
      s.remove(0, "'use client'".length);
    }

    // If not a virtual SSR file, just remove the directive and return
    if (!id.includes("virtual:rwsdk:ssr")) {
      log("Not an SSR file, returning code with directive removed");
      return {
        code: s.toString(),
        map: s.generateMap({ hires: true }),
      };
    }

    // For SSR files, apply the complete transformation
    log("Transforming SSR file:", id);
    const relFilePath = id.includes("?") ? id.split("?")[0] : id;
    const relativeId = relative(process.cwd(), relFilePath);

    return transformClientComponents(code, relativeId);
  },
});
