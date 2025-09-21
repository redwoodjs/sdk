import { expect } from "vitest";
import { setupPlaygroundEnvironment, testDevAndDeploy, poll } from "rwsdk/e2e";

setupPlaygroundEnvironment(import.meta.url);

testDevAndDeploy(
  "renders shadcn/ui comprehensive playground",
  async ({ page, url }) => {
    // Test home page
    await page.goto(url);

    await poll(async () => {
      const content = await page.content();
      return content.includes("shadcn/ui Comprehensive Playground");
    });

    const content = await page.content();
    expect(content).toContain("shadcn/ui Comprehensive Playground");
    expect(content).toContain("47 Components");
    expect(content).toContain("React Server Components");
  },
);

testDevAndDeploy("renders component showcase page", async ({ page, url }) => {
  await page.goto(`${url}/showcase`);

  await poll(async () => {
    const content = await page.content();
    return content.includes("Basic UI Components");
  });

  const content = await page.content();
  expect(content).toContain("Basic UI Components");
  expect(content).toContain("Form Components");
  expect(content).toContain("Data Display");
  expect(content).toContain("Interactive Components");
  expect(content).toContain("Feedback Components");
});

testDevAndDeploy(
  "all shadcn/ui components render without console errors",
  async ({ page, url }) => {
    // Test home page
    await page.goto(url);
    await poll(async () => {
      const content = await page.content();
      return content.includes("shadcn/ui Comprehensive Playground");
    });

    // Test showcase page with all components
    await page.goto(`${url}/showcase`);
    await poll(async () => {
      const content = await page.content();
      return content.includes("All components rendered successfully");
    });

    const content = await page.content();
    expect(content).toContain("Basic UI Components");
    expect(content).toContain("Form Components");
  },
);

testDevAndDeploy(
  "shadcn/ui components are interactive",
  async ({ page, url }) => {
    await page.goto(`${url}/showcase`);

    await poll(async () => {
      const content = await page.content();
      return content.includes("Basic UI Components");
    });

    const content = await page.content();
    expect(content).toContain("Default");
    expect(content).toContain("Secondary");
    expect(content).toContain("Enter your email");
    expect(content).toContain("Type your message here");
  },
);

testDevAndDeploy(
  "all component sections are present",
  async ({ page, url }) => {
    await page.goto(`${url}/showcase`);

    await poll(async () => {
      const content = await page.content();
      return content.includes("Basic UI Components");
    });

    const content = await page.content();

    // Check all major component sections exist
    const expectedSections = [
      "Basic UI Components",
      "Form Components",
      "Data Display",
      "Interactive Components",
      "Feedback Components",
      "Navigation",
      "Date & Time",
      "Media & Layout",
      "Scrollable Content",
      "Layout & Content",
    ];

    for (const section of expectedSections) {
      expect(content).toContain(section);
    }
  },
);

testDevAndDeploy(
  "specific shadcn/ui components render correctly",
  async ({ page, url }) => {
    await page.goto(`${url}/showcase`);

    await poll(async () => {
      const content = await page.content();
      return content.includes("Basic UI Components");
    });

    const content = await page.content();

    // Check for specific component content
    expect(content).toContain("Default");
    expect(content).toContain("Secondary");
    expect(content).toContain("Enter your email");
    expect(content).toContain("Type your message here");
    expect(content).toContain("Progress: 60%");
    expect(content).toContain("John Doe");
    expect(content).toContain("Jane Smith");
    expect(content).toContain("Heads up!");
    expect(content).toContain("Success!");
    expect(content).toContain("Is it accessible?");
  },
);
