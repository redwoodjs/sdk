// @ts-check
import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";

// https://astro.build/config
export default defineConfig({
  integrations: [
    starlight({
      expressiveCode: {
        // themes: ["dracula"],
        shiki: {
          
          bundledLangs: ['bash', 'ts', 'tsx'],
        },
      },
      title: "RedwoodSDK",
      logo: {
        src: "./src/assets/logo.svg",
        replacesTitle: true,
      },
      customCss: [
        // Relative path to your custom CSS file
        "./src/styles/custom.css",
      ],
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
            { label: "Overview", slug: "core/overview" },
            { label: "Routing", slug: "core/routing" },
            {
              label: "React Server Components",
              slug: "core/react-server-components",
            },
            { label: "Database", slug: "core/database" },
            { label: "Storage", slug: "core/storage" },
            { label: "Queues", slug: "core/queues" },
            { label: "Authentication", slug: "core/authentication" },
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
        {
          label: "Reference",

          autogenerate: { directory: "reference", collapsed: true },
        },
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
    }),
  ],
});
