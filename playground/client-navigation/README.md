## Client Navigation Playground

This playground demonstrates client-side navigation features in RedwoodSDK.

- **Home page (`/`)**: A client component that uses `navigate` to programmatically move to different pages and renders a prefetch `<link>` to warm the RSC cache.
- **About page (`/about`)**:
  - A server component that shows a basic About layout.
  - Includes a `React.Suspense` boundary that wraps an async server component with an artificial delay.
- **Suspense Pages (`/suspense-one`, `/suspense-two`)**:
  - Pages designed to test end-to-end RSC streaming during client navigation.
  - Each page has an async server component wrapped in a `React.Suspense` boundary with a "skeleton" loading state.
  - Navigation between these pages exercises the `tee()`-based streaming implementation in the client runtime, ensuring that the browser doesn't deadlock when one branch of a tee'd stream isn't immediately consumed.
  - **Note on identical structures**: If you are navigating between routes that share an identical component structure (e.g., using the same Page component for different paths), you must provide a unique `key` to your `Suspense` boundaries (e.g., `<Suspense key={path} ...>`). This ensures React treats it as a new boundary and correctly shows the fallback UI during the transition.

End-to-end tests in `__tests__/e2e.test.mts` verify that:

1. Suspense fallbacks are shown immediately during client navigation (streaming is working).
2. Navigating between pages with async content doesn't deadlock (the `tee()` branch is correctly handled).
3. Prefetch links are correctly hoisted and used.
