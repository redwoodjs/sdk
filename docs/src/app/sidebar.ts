import type * as PageTree from "fumadocs-core/page-tree";

const p = (name: string, slug: string): PageTree.Item => ({
  type: "page",
  name,
  url: `/${slug}`,
});

export const pageTree: PageTree.Root = {
  name: "RedwoodSDK Docs",
  children: [
    { type: "separator", name: "Get Started" },
    p("Quick Start", "getting-started/quick-start"),
    p("Migrating to 1.x", "migrating"),

    { type: "separator", name: "Core" },
    p("Overview", "core/overview"),
    p("Request Handling & Routing", "core/routing"),
    p("React Server Components", "core/react-server-components"),
    p("Storage", "core/storage"),
    p("Queues", "core/queues"),
    p("Cron", "core/cron"),
    p("Email", "core/email"),
    p("Environment Variables", "core/env-vars"),
    p("Authentication", "core/authentication"),
    p("Security", "core/security"),
    p("Hosting", "core/hosting"),

    { type: "separator", name: "Experimental" },
    p("Realtime", "experimental/realtime"),
    p("Database", "experimental/database"),
    p("Authentication", "experimental/authentication"),

    { type: "separator", name: "Guides" },
    {
      type: "folder",
      name: "Frontend Development",
      children: [
        p("Tailwind CSS", "guides/frontend/tailwind"),
        p("Storybook", "guides/frontend/storybook"),
        p("shadcn/ui", "guides/frontend/shadcn"),
        p("Chakra UI", "guides/frontend/chakra-ui"),
        p("Ark UI", "guides/frontend/ark-ui"),
        p("Layouts", "guides/frontend/layouts"),
        p("Documents", "guides/frontend/documents"),
        p("Public Assets", "guides/frontend/public-assets"),
        p("Metadata", "guides/frontend/metadata"),
        p("Dynamic OG Images", "guides/frontend/og-images"),
        p("Client Side Navigation (SPA)", "guides/frontend/client-side-nav"),
        p("Error Handling", "guides/frontend/error-handling"),
        p("Dark / Light Mode", "guides/frontend/dark-mode"),
        p("Image Optimization", "guides/frontend/images"),
      ],
    },
    {
      type: "folder",
      name: "Email",
      children: [
        p("Sending Email", "guides/email/sending-email"),
        p("Email Templates", "guides/email/email-templates"),
      ],
    },
    {
      type: "folder",
      name: "Database",
      children: [
        p("Drizzle", "guides/database/drizzle"),
      ],
    },
    {
      type: "folder",
      name: "Optimize",
      children: [
        p("React Compiler", "guides/optimize/react-compiler"),
      ],
    },
    p("Server Function Streams", "guides/rsc-streams"),
    p("Debugging", "guides/debugging"),
    p("Vitest", "guides/vitest"),
    p("Troubleshooting", "guides/troubleshooting"),

    { type: "separator", name: "Reference" },
    p("create-rwsdk", "reference/create-rwsdk"),
    p("sdk/worker", "reference/sdk-worker"),
    p("sdk/router", "reference/sdk-router"),
    p("sdk/client", "reference/sdk-client"),

    { type: "separator", name: "Legacy" },
    p("Realtime", "legacy/realtime"),
  ],
};
