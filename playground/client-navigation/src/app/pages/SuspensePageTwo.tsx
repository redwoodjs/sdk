import React from "react";

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function PageTwoContent() {
  await delay(1200);

  return (
    <div>
      <p data-testid="page-two-content">Page Two content loaded</p>
    </div>
  );
}

export function SuspensePageTwo() {
  return (
    <div key="suspense-page-two">
      <h1>Suspense Page Two</h1>

      <nav>
        <a href="/suspense-one" data-testid="link-to-page-one">
          Go to Suspense Page One
        </a>
      </nav>

      <React.Suspense
        key="page-two-suspense"
        fallback={
          <div data-testid="page-two-skeleton">
            <p>Loading Page Two skeleton...</p>
          </div>
        }
      >
        <PageTwoContent />
      </React.Suspense>
    </div>
  );
}
