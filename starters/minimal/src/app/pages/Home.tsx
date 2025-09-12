// Try to import Start component, fall back if folder is deleted
let Start: React.ComponentType | null = null;
try {
  Start = await import("../start/Start").then((m) => m.Start);
} catch {
  // Start folder deleted, use fallback
}

export function Home() {
  // Show start page in dev, unless start folder was deleted
  if (import.meta.env.DEV && Start) {
    return <Start />;
  }

  return <div>Hello World</div>;
}
