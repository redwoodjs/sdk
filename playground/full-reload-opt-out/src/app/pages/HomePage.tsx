import type { RequestInfo } from "rwsdk/worker";

export function HomePage({ ctx }: RequestInfo) {
  ctx;
  return (
    <div>
      <h1>Home Page</h1>
      <p>The home section uses a light blue stylesheet.</p>
      <a href="/admin" id="admin-link">
        Go to Admin (shouldIntercept reload)
      </a>
    </div>
  );
}
