// @ts-check
import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";
import starlightLlmsTxt from "starlight-llms-txt";

// https://astro.build/config
export default defineConfig({
  site: "https://docs.rwsdk.com",
  integrations: [
    starlight({
      plugins: [starlightLlmsTxt()],
      expressiveCode: {
        shiki: {
          bundledLangs: ["bash", "ts", "tsx"],
        },
      },
      title: "RedwoodSDK",
      logo: {
        light: "./src/assets/light-logo.svg",
        dark: "./src/assets/dark-logo.svg",
        replacesTitle: true,
      },
      customCss: ["./src/styles/custom.css"],
      social: {
        github: "https://github.com/redwoodjs/sdk",
      },
      sidebar: [
        {
          label: "Get Started",
          items: [
            { label: "Quick Start", slug: "getting-started/quick-start" },
          ],
        },
        {
          label: "Core",
          items: [
            { slug: "core/overview" },
            { label: "Request Handling & Routing", slug: "core/routing" },
            { slug: "core/react-server-components" },
            { slug: "core/database" },
            { slug: "core/database-do" },
            { slug: "core/storage" },
            { slug: "core/realtime" },
            { slug: "core/queues" },
            { slug: "core/cron" },
            { label: "Environment variables", slug: "core/env-vars" },
            { slug: "core/authentication" },
            { slug: "core/security" },
            { slug: "core/hosting" },
          ],
        },
        {
          label: "Tutorial",
          items: [
            {
              label: "Full Stack Applications",
              collapsed: true,
              items: [
                {
                  label: "Project Setup",
                  slug: "tutorial/full-stack-app/setup",
                },
                {
                  label: "Creating the Application",
                  slug: "tutorial/full-stack-app/create-app",
                },
                {
                  label: "Database Setup",
                  slug: "tutorial/full-stack-app/database-setup",
                },
                {
                  label: "Authentication",
                  slug: "tutorial/full-stack-app/auth",
                },
                {
                  label: "Jobs List",
                  slug: "tutorial/full-stack-app/jobs-list",
                },
                {
                  label: "Jobs Form",
                  slug: "tutorial/full-stack-app/jobs-form",
                },
                { label: "Contacts", slug: "tutorial/full-stack-app/contacts" },
                {
                  label: "Jobs Details",
                  slug: "tutorial/full-stack-app/jobs-details",
                },
                {
                  label: "Deploying",
                  slug: "tutorial/full-stack-app/deploying",
                },
              ],
            },
          ],
        },
        {
          label: "Guides",
          items: [
            {
              label: "Email",
              collapsed: false,
              items: [
                { label: "Sending Email", slug: "guides/email/sending-email" },
                {
                  label: "Email Templates",
                  slug: "guides/email/email-templates",
                },
              ],
            },
            {
              label: "Frontend Development",
              collapsed: false,
              items: [
                { label: "Tailwind CSS", slug: "guides/frontend/tailwind" },
                { label: "Storybook", slug: "guides/frontend/storybook" },
                { label: "shadcn/ui", slug: "guides/frontend/shadcn" },
                { label: "Layouts", slug: "guides/frontend/layouts" },
                { label: "Documents", slug: "guides/frontend/documents" },
                {
                  label: "Public Assets",
                  slug: "guides/frontend/public-assets",
                },
                { label: "Metadata", slug: "guides/frontend/metadata" },
                {
                  label: "Dynamic OG Images",
                  slug: "guides/frontend/og-images",
                },
                {
                  label: "Client Side Navigation (SPA)",
                  slug: "guides/frontend/client-side-nav",
                },
              ],
            },
            { label: "Server Function Streams", slug: "guides/rsc-streams" },
          ],
          collapsed: true,
        },
        {
          label: "Reference",
          items: [
            { slug: "reference/create-rwsdk" },
            { slug: "reference/sdk-worker" },
            { slug: "reference/sdk-router" },
            { slug: "reference/sdk-client" },
          ],
          collapsed: true,
        },
      ],
      head: [
        // Open Graph Meta Tags
        {
          tag: "meta",
          attrs: {
            property: "og:title",
            content:
              "RedwoodSDK Documentation | The React Framework for Cloudflare.",
          },
        },
        {
          tag: "meta",
          attrs: {
            property: "og:description",
            content:
              "RedwoodSDK is a React Framework for Cloudflare. It begins as a Vite plugin that unlocks SSR, React Server Components, Server Functions, and realtime features.  Its standards-based router, with support for middleware and  interrupters, gives you fine-grained control over every request and  response.",
          },
        },
        {
          tag: "meta",
          attrs: {
            property: "og:image",
            content:
              "https://imagedelivery.net/EBSSfnGYYD9-tGTmYMjDgg/b1fee579-c064-4495-3473-bf9656d8d400/public",
          },
        },
        {
          tag: "meta",
          attrs: {
            property: "og:url",
            content: "https://docs.rwsdk.com/",
          },
        },
        {
          tag: "meta",
          attrs: {
            property: "og:type",
            content: "website",
          },
        },
        // Twitter Card Meta Tags
        {
          tag: "meta",
          attrs: {
            name: "twitter:card",
            content: "summary_large_image",
          },
        },
        {
          tag: "meta",
          attrs: {
            name: "twitter:title",
            content: "RedwoodSDK Docs",
          },
        },
        {
          tag: "meta",
          attrs: {
            name: "twitter:description",
            content:
              "Official RedwoodSDK documentation for building full-stack React applications on Cloudflare.",
          },
        },
        {
          tag: "meta",
          attrs: {
            name: "twitter:image",
            content:
              "https://imagedelivery.net/EBSSfnGYYD9-tGTmYMjDgg/b1fee579-c064-4495-3473-bf9656d8d400/public",
          },
        },
        {
          tag: "script",
          attrs: {
            src: "https://scripts.simpleanalyticscdn.com/latest.js",
            async: true,
            defer: true,
          },
        },
        {
          tag: "noscript",
          content: `<img src="https://queue.simpleanalyticscdn.com/noscript.gif" alt="" referrerpolicy="no-referrer-when-downgrade" />`,
        },
      ],
    }),
  ],
});
