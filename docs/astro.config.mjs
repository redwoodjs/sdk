// @ts-check
import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";
import partytown from "@astrojs/partytown";

// https://astro.build/config
export default defineConfig({
  site: "https://docs.rwsdk.com",
  integrations: [
    partytown({
      config: {
        forward: ["dataLayer.push"],
      },
    }),
    starlight({
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
            { label: "Request Handling", slug: "core/routing" },
            { slug: "core/react-server-components" },
            { slug: "core/database" },
            { slug: "core/storage" },
            { slug: "core/realtime" },
            { slug: "core/queues" },
            { slug: "core/authentication" },
            { slug: "core/security" },
            { slug: "core/hosting" },
          ],
        },
        // {
        //   label: "Tutorial",
        //   items: [
        //     {
        //       label: "Full Stack Applications",
        //       collapsed: true,
        //       items: [
        //         {
        //           label: "Project Setup",
        //           slug: "tutorial/full-stack-app/setup",
        //         },
        //         {
        //           label: "Creating the Application",
        //           slug: "tutorial/full-stack-app/create-app",
        //         },
        //         {
        //           label: "Database Setup",
        //           slug: "tutorial/full-stack-app/database-setup",
        //         },
        //         {
        //           label: "Authentication",
        //           slug: "tutorial/full-stack-app/auth",
        //         },
        //         {
        //           label: "Jobs List",
        //           slug: "tutorial/full-stack-app/jobs-list",
        //         },
        //         {
        //           label: "Jobs Form",
        //           slug: "tutorial/full-stack-app/jobs-form",
        //         },
        //         { label: "Contacts", slug: "tutorial/full-stack-app/contacts" },
        //         {
        //           label: "Jobs Details",
        //           slug: "tutorial/full-stack-app/jobs-details",
        //         },
        //         {
        //           label: "Deploying",
        //           slug: "tutorial/full-stack-app/deploying",
        //         },
        //       ],
        //     },
        //     {
        //       label: "Advanced Topics",
        //       collapsed: true,
        //       items: [
        //         {
        //           label: "Form Validation",
        //           slug: "tutorial/advanced-topics/validation",
        //         },
        //         {
        //           label: "File Uploads with r2",
        //           slug: "tutorial/advanced-topics/uploads",
        //         },
        //         {
        //           label: "Attaching Notes",
        //           slug: "tutorial/advanced-topics/notes",
        //         },
        //         {
        //           label: "Resumes and Cover Letters",
        //           slug: "tutorial/advanced-topics/resumes-cover-letters",
        //         },
        //         {
        //           label: "Integrating with AI",
        //           slug: "tutorial/advanced-topics/ai",
        //         },
        //         {
        //           label: "Queues and Background Jobs",
        //           slug: "tutorial/advanced-topics/queues",
        //         },
        //         {
        //           label: "Email Integration",
        //           slug: "tutorial/advanced-topics/email",
        //         },
        //         {
        //           label: "Extending Authentication",
        //           slug: "tutorial/advanced-topics/auth",
        //         },
        //         {
        //           label: "Building a Dashboard",
        //           slug: "tutorial/advanced-topics/dashboard",
        //         },
        //         {
        //           label: "Testing Your Application",
        //           slug: "tutorial/advanced-topics/testing",
        //         },
        //         { label: "CI/CD", slug: "tutorial/advanced-topics/cicd" },
        //       ],
        //     },
        //   ],
        // },
        // {
        //   label: "Explanations & Concepts",
        //   collapsed: true,
        //   items: [
        //     {
        //       label: "Architecture Overview",
        //       slug: "getting-started/installation",
        //     },
        //     { label: "Why Redwood SDK?", slug: "getting-started/installation" },
        //     {
        //       label: "Server vs Client Components",
        //       slug: "getting-started/installation",
        //     },
        //     {
        //       label: "Integration Philosophy",
        //       slug: "getting-started/installation",
        //     },
        //     {
        //       label: "Performance Considerations",
        //       slug: "getting-started/installation",
        //     },
        //     {
        //       label: "Security Best Practices",
        //       slug: "getting-started/installation",
        //     },
        //     {
        //       label: "AI Integration Philosophy",
        //       slug: "getting-started/installation",
        //     },
        //     {
        //       label: "UI Component Strategy",
        //       slug: "getting-started/installation",
        //     },
        //   ],
        // },
      ],
      head: [
        // Open Graph Meta Tags
        {
          tag: "meta",
          attrs: {
            property: "og:title",
            content: "RedwoodSDK Documentation"
          }
        },
        {
          tag: "meta",
          attrs: {
            property: "og:description",
            content: "Learn how to build and deploy full-stack apps with RedwoodSDK and Cloudflare."
          }
        },
        {
          tag: "meta",
          attrs: {
            property: "og:image",
            content: "./src/assets/og-docs.png"
          }
        },
        {
          tag: "meta",
          attrs: {
            property: "og:url",
            content: "https://docs.rwsdk.com/"
          }
        },
        {
          tag: "meta",
          attrs: {
            property: "og:type",
            content: "website"
          }
        },
        // Twitter Card Meta Tags
        {
          tag: "meta",
          attrs: {
            name: "twitter:card",
            content: "summary_large_image"
          }
        },
        {
          tag: "meta",
          attrs: {
            name: "twitter:title",
            content: "RedwoodSDK Docs"
          }
        },
        {
          tag: "meta",
          attrs: {
            name: "twitter:description",
            content: "Official RedwoodSDK documentation for building full-stack JS apps fast."
          }
        },
        {
          tag: "meta",
          attrs: {
            name: "twitter:image",
            content: "./src/assets/og-docs.png"
          }
        },
        {
          tag: "script",
          attrs: {
            src: "https://www.googletagmanager.com/gtag/js?id=G-NVF3LN88NZ",
            async: true,
            type: "text/partytown",
          },
        },
        {
          tag: "script",
          attrs: {
            type: "text/partytown",
          },
          content: `
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', 'G-NVF3LN88NZ');
        `,
        },
      ],
    }),
  ],
});
