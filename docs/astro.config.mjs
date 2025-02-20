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
              label: 'Your First App',
              items: [
                { label: 'Project Setup', slug: 'tutorial/first/project-setup' },
                { label: 'Project Structure', slug: 'tutorial/first/project-structure' },
                { label: 'Router', slug: 'tutorial/first/router' },
                { label: 'React Server Components', slug: 'tutorial/first/react-server-components' },
                { label: 'Deploying to Cloudflare', slug: 'tutorial/first/deploying-to-cloudflare' },
              ]
            },
            {
              label: 'Full Stack Applications',
              collapsed: true,
              items: [
                { label: 'Project Setup', slug: 'tutorial/first/project-setup' },
                { label: 'Setting Up Your Database', slug: 'tutorial/first/project-structure' },
                { label: 'Creating Your First Model', slug: 'tutorial/first/router' },
                { label: 'Building CRUD Operations', slug: 'tutorial/first/react-server-components' },
                { label: 'Adding Authentication', slug: 'tutorial/first/deploying-to-cloudflare' },
                { label: 'Deploying Your Application', slug: 'tutorial/first/deploying-to-cloudflare' },
              ]
            },
            {
              label: 'Advanced Topics',
              collapsed: true,
              items: [
                { label: 'Working with Forms', slug: 'tutorial/first/project-setup' },
                { label: 'File Uploads with r2', slug: 'tutorial/first/project-structure' },
                { label: 'Adding Authentication', slug: 'tutorial/first/router' },
                { label: 'Email Integration', slug: 'tutorial/first/react-server-components' },
                { label: 'Custom Styling with Tailwind', slug: 'tutorial/first/deploying-to-cloudflare' },
                { label: 'Setting up ShadCN UI', slug: 'tutorial/first/deploying-to-cloudflare' },
                { label: 'Testing Your Application', slug: 'tutorial/first/deploying-to-cloudflare' },
                { label: 'Integrating with AI', slug: 'tutorial/first/deploying-to-cloudflare' },
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
                { label: 'Setting up Prisma', slug: 'getting-started/installation' },
                { label: 'Working with d1 Database', slug: 'getting-started/installation' },
                { label: 'CRUD', slug: 'getting-started/installation' },
              ]
            },
            {
              label: 'Authentication & Security',
              collapsed: true,
              items: [
                { label: 'Setting up Authentication', slug: 'getting-started/installation' },
                { label: 'Managing User Sessions', slug: 'getting-started/installation' },
                { label: 'Role-Based Access Control', slug: 'getting-started/installation' },
              ]
            },
            {
              label: 'Frontend Development',
              collapsed: true,
              items: [
                { label: 'React Server Components', slug: 'getting-started/installation' },
                { label: 'Form Handling', slug: 'getting-started/installation' },
                { label: 'File Uploads with R2 ', slug: 'getting-started/installation' },
                { label: 'Setting up Tailwind CSS', slug: 'getting-started/installation' },
                { label: 'Integrating with ShadCN UI', slug: 'getting-started/installation' },
              ]
            },
            {
              label: 'Backend Development',
              collapsed: true,
              items: [
                { label: 'API Routes', slug: 'getting-started/installation' },
                { label: 'Database Migrations', slug: 'getting-started/installation' },
                { label: 'Background Jobs', slug: 'getting-started/installation' },
                { label: 'Scheduled Tasks', slug: 'getting-started/installation' },
                { label: 'Email Integration', slug: 'getting-started/installation' },
                { label: 'Integrating with AI', slug: 'getting-started/installation' },
                { label: 'Error Handling', slug: 'getting-started/installation' },
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
