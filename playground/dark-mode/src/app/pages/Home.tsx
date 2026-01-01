import { RequestInfo } from "rwsdk/worker";
import { ThemeToggle } from "../components/ThemeToggle";

export function Home({ ctx }: RequestInfo) {
  const theme = ctx.theme || "system";

  return (
    <div className="min-h-screen p-8 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 transition-colors">
      <div className="max-w-4xl mx-auto">
        <header className="mb-8">
          <h1 className="text-4xl font-bold mb-4">Dark Mode Playground</h1>
          <p className="text-lg mb-4">
            This playground demonstrates dark and light mode themes in
            RedwoodSDK.
          </p>
          <ThemeToggle initialTheme={theme} />
        </header>

        <main className="space-y-8">
          <section className="p-6 bg-gray-100 dark:bg-gray-800 rounded-lg">
            <h2 className="text-2xl font-semibold mb-4">Theme Modes</h2>
            <ul className="list-disc list-inside space-y-2">
              <li>
                <strong>System:</strong> Follows your system preference
              </li>
              <li>
                <strong>Light:</strong> Always use light mode
              </li>
              <li>
                <strong>Dark:</strong> Always use dark mode
              </li>
            </ul>
          </section>

          <section className="p-6 bg-blue-50 dark:bg-blue-900 rounded-lg">
            <h2 className="text-2xl font-semibold mb-4">Features</h2>
            <ul className="list-disc list-inside space-y-2">
              <li>Cookie-based persistence of user preference</li>
              <li>Server action to update theme</li>
              <li>Prevents FOUC (Flash of Unstyled Content)</li>
              <li>Tailwind CSS dark mode support</li>
            </ul>
          </section>

          <section className="p-6 bg-green-50 dark:bg-green-900 rounded-lg">
            <h2 className="text-2xl font-semibold mb-4">Try It Out</h2>
            <p>
              Click the theme toggle button above to cycle through the three
              theme modes. Your preference will be saved in a cookie and persist
              across page reloads.
            </p>
          </section>
        </main>
      </div>
    </div>
  );
}

