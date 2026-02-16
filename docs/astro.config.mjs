// @ts-check
import starlight from "@astrojs/starlight";
import { defineConfig } from "astro/config";
import starlightLlmsTxt from "starlight-llms-txt";

// https://astro.build/config
export default defineConfig({
  site: "https://docs.rwsdk.com",
  integrations: [
    starlight({
      plugins: [starlightLlmsTxt()],
      components: {
        // Override the default PageTitle component to support experimental badges
        PageTitle: "./src/components/PageTitle.astro",
      },
      expressiveCode: {
        themes: ["github-dark", "github-light"],
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
      social: [
        {
          icon: "github",
          label: "GitHub",
          href: "https://github.com/redwoodjs/sdk",
        },
        {
          icon: "discord",
          label: "Discord",
          href: "https://community.redwoodjs.com/",
        },
      ],
      sidebar: [
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
            { slug: "core/overview" },
            { label: "Request Handling & Routing", slug: "core/routing" },
            { slug: "core/react-server-components" },
            { slug: "core/storage" },
            { slug: "core/queues" },
            { slug: "core/cron" },
            { slug: "core/email" },
            { label: "Environment variables", slug: "core/env-vars" },
            { slug: "core/authentication" },
            { slug: "core/security" },
            { slug: "core/hosting" },
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
                {
                  label: "Error Handling",
                  slug: "guides/frontend/error-handling",
                },
                {
                  label: "Dark / Light Mode",
                  slug: "guides/frontend/dark-mode",
                },
                {
                  label: "Image Optimization",
                  slug: "guides/frontend/images",
                },
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
                {
                  label: "React Compiler",
                  slug: "guides/optimize/react-compiler",
                },
              ],
            },
            { label: "Server Function Streams", slug: "guides/rsc-streams" },
            { label: "Build with AI", slug: "guides/build-with-ai" },
            { label: "Debugging", slug: "guides/debugging" },
            { label: "Vitest", slug: "guides/vitest" },
          ],
        },
        {
          label: "Reference",
          items: [
            { slug: "reference/create-rwsdk" },
            { slug: "reference/sdk-worker" },
            { slug: "reference/sdk-router" },
            { slug: "reference/sdk-client" },
          ],
        },
        {
          label: "Legacy",
          collapsed: true,
          items: [
            { label: "Realtime", slug: "legacy/realtime" },
          ],
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
