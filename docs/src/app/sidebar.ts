export type SidebarLink = {
  label: string;
  slug: string;
};

export type SidebarGroup = {
  label: string;
  collapsed?: boolean;
  items: (SidebarLink | SidebarGroup)[];
};

export type SidebarItem = SidebarLink | SidebarGroup;

export function isGroup(item: SidebarItem): item is SidebarGroup {
  return "items" in item;
}

export const sidebar: SidebarItem[] = [
  {
    label: "Get Started",
    items: [
      { label: "Quick Start", slug: "getting-started/quick-start" },
      { label: "Migrating to 1.x", slug: "migrating" },
    ],
  },
  {
    label: "Core",
    items: [
      { label: "Overview", slug: "core/overview" },
      { label: "Request Handling & Routing", slug: "core/routing" },
      { label: "React Server Components", slug: "core/react-server-components" },
      { label: "Storage", slug: "core/storage" },
      { label: "Queues", slug: "core/queues" },
      { label: "Cron", slug: "core/cron" },
      { label: "Email", slug: "core/email" },
      { label: "Environment Variables", slug: "core/env-vars" },
      { label: "Authentication", slug: "core/authentication" },
      { label: "Security", slug: "core/security" },
      { label: "Hosting", slug: "core/hosting" },
    ],
  },
  {
    label: "Experimental",
    items: [
      { label: "Realtime", slug: "experimental/realtime" },
      { label: "Database", slug: "experimental/database" },
      { label: "Authentication", slug: "experimental/authentication" },
    ],
  },
  {
    label: "Guides",
    items: [
      {
        label: "Frontend Development",
        collapsed: true,
        items: [
          { label: "Tailwind CSS", slug: "guides/frontend/tailwind" },
          { label: "Storybook", slug: "guides/frontend/storybook" },
          { label: "shadcn/ui", slug: "guides/frontend/shadcn" },
          { label: "Chakra UI", slug: "guides/frontend/chakra-ui" },
          { label: "Ark UI", slug: "guides/frontend/ark-ui" },
          { label: "Layouts", slug: "guides/frontend/layouts" },
          { label: "Documents", slug: "guides/frontend/documents" },
          { label: "Public Assets", slug: "guides/frontend/public-assets" },
          { label: "Metadata", slug: "guides/frontend/metadata" },
          { label: "Dynamic OG Images", slug: "guides/frontend/og-images" },
          {
            label: "Client Side Navigation (SPA)",
            slug: "guides/frontend/client-side-nav",
          },
          { label: "Error Handling", slug: "guides/frontend/error-handling" },
          { label: "Dark / Light Mode", slug: "guides/frontend/dark-mode" },
          { label: "Image Optimization", slug: "guides/frontend/images" },
        ],
      },
      {
        label: "Email",
        collapsed: true,
        items: [
          { label: "Sending Email", slug: "guides/email/sending-email" },
          {
            label: "Email Templates",
            slug: "guides/email/email-templates",
          },
        ],
      },
      {
        label: "Optimize",
        collapsed: true,
        items: [
          { label: "React Compiler", slug: "guides/optimize/react-compiler" },
        ],
      },
      { label: "Server Function Streams", slug: "guides/rsc-streams" },
      { label: "Debugging", slug: "guides/debugging" },
      { label: "Vitest", slug: "guides/vitest" },
    ],
  },
  {
    label: "Reference",
    items: [
      { label: "create-rwsdk", slug: "reference/create-rwsdk" },
      { label: "sdk/worker", slug: "reference/sdk-worker" },
      { label: "sdk/router", slug: "reference/sdk-router" },
      { label: "sdk/client", slug: "reference/sdk-client" },
    ],
  },
  {
    label: "Legacy",
    collapsed: true,
    items: [{ label: "Realtime", slug: "legacy/realtime" }],
  },
];
