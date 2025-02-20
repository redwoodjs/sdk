// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

// https://astro.build/config
export default defineConfig({
  integrations: [
    starlight({
      title: 'Redwood SDK',
      logo: {
        src: './src/assets/logo.svg',
        replacesTitle: true,
      },
      customCss: [
        // Relative path to your custom CSS file
        './src/styles/custom.css',
      ],
      social: {
        github: 'https://github.com/redwoodjs/sdk',
      },
      sidebar: [
        {
          label: 'Quick Start',
          items: [
            { label: 'Installation', slug: 'getting-started/installation' },
            { label: 'Creating Your First Project', slug: 'getting-started/first-project' },
          ],
        },
        {
          label: 'Tutorial',
          items: [
            {
              label: 'Full Stack Applications',
              collapsed: true,
              items: [
                { label: 'Project Setup', slug: 'tutorial/full-stack-app/setup' },
                { label: 'Creating the Application', slug: 'tutorial/full-stack-app/create-app' },
                { label: 'Database Setup', slug: 'tutorial/full-stack-app/database-setup' },
                { label: 'Authentication', slug: 'tutorial/full-stack-app/auth' },
                { label: 'Jobs List', slug: 'tutorial/full-stack-app/jobs-list' },
                { label: 'Jobs Form', slug: 'tutorial/full-stack-app/jobs-form' },
                { label: 'Jobs Details', slug: 'tutorial/full-stack-app/jobs-details' },
                { label: 'Contacts', slug: 'tutorial/full-stack-app/contacts' },
                { label: 'Deploying', slug: 'tutorial/full-stack-app/deploying' },
              ]
            },
            {
              label: 'Advanced Topics',
              collapsed: true,
              items: [
                { label: 'Working with Forms', slug: 'tutorial/advanced-topics/forms' },
                { label: 'File Uploads with r2', slug: 'tutorial/advanced-topics/uploads' },
                { label: 'Adding Authentication', slug: 'tutorial/advanced-topics/auth' },
                { label: 'Email Integration', slug: 'tutorial/advanced-topics/email' },
                { label: 'Custom Styling with Tailwind', slug: 'tutorial/advanced-topics/tailwind' },
                { label: 'Setting up ShadCN UI', slug: 'tutorial/advanced-topics/shadcn' },
                { label: 'Queues and Background Jobs', slug: 'tutorial/advanced-topics/queues' },
                { label: 'Testing Your Application', slug: 'tutorial/advanced-topics/testing' },
                { label: 'Integrating with AI', slug: 'tutorial/advanced-topics/ai' },
              ]
            },
          ],
        },
        {
          label: 'How-To Guides',
          collapsed: true,
          items: [
            {
              label: 'Databases & Data',
              collapsed: true,
              items: [
                { label: 'CRUD', slug: 'guides/db-data/crud' },
                { label: 'Setting up Prisma', slug: 'guides/db-data/prisma' },
                { label: 'Working with d1 Database', slug: 'guides/db-data/d1' },
              ]
            },
            {
              label: 'Authentication & Security',
              collapsed: true,
              items: [
                { label: 'Setting up Authentication', slug: 'guides/auth/setup' },
                { label: 'Managing User Sessions', slug: 'guides/auth/sessions' },
                { label: 'Role-Based Access Control', slug: 'guides/auth/rbac' },
              ]
            },
            {
              label: 'Frontend Development',
              collapsed: true,
              items: [
                { label: 'React Server Components', slug: 'guides/frontend/react-server-components' },
                { label: 'Form Handling', slug: 'guides/frontend/forms' },
                { label: 'File Uploads with R2 ', slug: 'guides/frontend/r2' },
                { label: 'Setting up Tailwind CSS', slug: 'guides/frontend/tailwind' },
                { label: 'Integrating with ShadCN UI', slug: 'guides/frontend/shadcn' },
                { label: 'Customizing Layouts', slug: 'guides/frontend/layouts' },
              ]
            },
            {
              label: 'Backend Development',
              collapsed: true,
              items: [
                { label: 'API Routes', slug: 'guides/backend/api' },
              ]
            },
            {
              label: 'AI Integration',
              collapsed: true,
              items: [
                { label: 'Cursor', slug: 'getting-started/installation' },
                { label: 'Setting up OpenAI Integration', slug: 'getting-started/installation' },
                { label: 'Setting up Anthropic Integration', slug: 'getting-started/installation' },
                { label: 'Setting up Gemini Integration', slug: 'getting-started/installation' },
                { label: 'Working with Cloudflare AI', slug: 'getting-started/installation' },
                { label: 'Building AI Powered Features', slug: 'getting-started/installation' },
                { label: 'Streaming AI Responses', slug: 'getting-started/installation' },
              ]
            },
            {
              label: 'Deployment',
              collapsed: true,
              items: [
                { label: 'Deploying to Cloudflare', slug: 'getting-started/installation' },
                { label: 'Setting up a Custom Domain', slug: 'getting-started/installation' },
                { label: 'Working with Cloudflare r2', slug: 'getting-started/installation' },
              ]
            },
            {
              label: 'Testing',
              collapsed: true,
              items: [
                { label: 'Setting up a Testing Environment', slug: 'getting-started/installation' },
                { label: 'Vitest', slug: 'getting-started/installation' },
                { label: 'Playwright', slug: 'getting-started/installation' },
                { label: 'Cyprus', slug: 'getting-started/installation' },
                { label: 'Testing Best Practices', slug: 'getting-started/installation' },
              ]
            },
          ],
        },
        {
          label: 'Reference',
          autogenerate: { directory: 'reference' },
        },
        {
          label: 'Explanations & Concepts',
          collapsed: true,
          items: [
            { label: 'Architecture Overview', slug: 'getting-started/installation' },
            { label: 'Why Redwood SDK?', slug: 'getting-started/installation' },
            { label: 'Server vs Client Components', slug: 'getting-started/installation' },
            { label: 'Integration Philosophy', slug: 'getting-started/installation' },
            { label: 'Performance Considerations', slug: 'getting-started/installation' },
            { label: 'Security Best Practices', slug: 'getting-started/installation' },
            { label: 'AI Integration Philosophy', slug: 'getting-started/installation' },
            { label: 'UI Component Strategy', slug: 'getting-started/installation' },
          ]
        },
      ],
    }),
  ],
  baseUrl: '/docs/introduction'
});
