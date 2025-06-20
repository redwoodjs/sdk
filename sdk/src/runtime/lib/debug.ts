// Simple debug function with DEBUG environment variable filtering
// Supports patterns like: DEBUG=passkey:* or DEBUG=passkey:database,passkey:functions

function isEnabled(namespace: string): boolean {
  const debug = process.env.DEBUG;
  if (!debug) return false;

  const patterns = debug.split(",").map((p) => p.trim());

  for (const pattern of patterns) {
    if (pattern.startsWith("-")) {
      const excludePattern = pattern.slice(1);
      if (matchesPattern(namespace, excludePattern)) {
        return false;
      }
      continue;
    }

    if (matchesPattern(namespace, pattern)) {
      return true;
    }
  }

  return false;
}

function matchesPattern(namespace: string, pattern: string): boolean {
  // Convert pattern to regex (handle * wildcards)
  const regex = pattern
    .replace(/\*/g, ".*") // * becomes .*
    .replace(/:/g, "\\:"); // escape colons

  return new RegExp(`^${regex}$`).test(namespace);
}

const debug = (namespace: string) => {
  return (...args: any[]) => {
    if (isEnabled(namespace)) {
      console.log(`[${namespace}]`, ...args);
    }
  };
};

export default debug;
