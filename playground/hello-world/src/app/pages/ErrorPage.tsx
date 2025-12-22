import { RequestInfo } from "rwsdk/worker";

export function ErrorPage({ ctx, error }: RequestInfo & { error?: unknown }) {
  return (
    <div>
      <h1>Error Page</h1>
      <p>An error occurred. Please check the console for details.</p>
      {error && (
        <div>
          <h2>Error Details</h2>
          <pre>{error instanceof Error ? error.message : String(error)}</pre>
        </div>
      )}
    </div>
  );
}
