import { Sidebar } from "@/app/components/Sidebar";
import { link } from "@/app/shared/links";

export function HomePage() {
  return (
    <div className="flex min-h-screen">
      <Sidebar currentSlug="" />
      <main className="flex-1 px-12 py-8 max-w-3xl">
        <h1 className="text-3xl font-bold mb-2">RedwoodSDK Documentation</h1>
        <p className="text-zinc-400 mb-4">
          RedwoodSDK is a React framework for Cloudflare. It starts as a Vite
          plugin that enables server-side rendering, React Server Components,
          server functions, streaming responses, and real-time capabilities.
        </p>
        <p className="text-zinc-400 mb-8">
          Its standards-based router — with support for middleware and
          interrupters — gives you fine-grained control over every request and
          response.
        </p>
        <div className="flex gap-4">
          <a
            href={link("/*", { $0: "getting-started/quick-start" })}
            className="rounded-md bg-orange-500 px-6 py-3 font-semibold text-white no-underline hover:opacity-85 transition-opacity"
          >
            Quick Start
          </a>
          <a
            href={link("/*", { $0: "core/overview" })}
            className="rounded-md border border-zinc-700 px-6 py-3 font-semibold text-zinc-200 no-underline hover:opacity-85 transition-opacity"
          >
            Overview
          </a>
        </div>
      </main>
    </div>
  );
}
