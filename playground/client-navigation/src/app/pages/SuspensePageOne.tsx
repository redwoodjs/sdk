import React from "react";

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function PageOneContent() {
  await delay(1000);

  return (
    <div>
      <p data-testid="page-one-content">Page One content loaded</p>
    </div>
  );
}

export function SuspensePageOne() {
  return (
    <div key="suspense-page-one">
      <h1>Suspense Page One</h1>

      <nav>
        <a href="/suspense-two" data-testid="link-to-page-two">
          Go to Suspense Page Two
        </a>
      </nav>

      <React.Suspense
        key="page-one-suspense"
        fallback={
          <div data-testid="page-one-skeleton">
            <p>Loading Page One skeleton...</p>
          </div>
        }
      >
        <PageOneContent />
      </React.Suspense>
    </div>
  );
}
