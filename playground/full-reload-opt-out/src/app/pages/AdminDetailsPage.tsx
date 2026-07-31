import type { RequestInfo } from "rwsdk/worker";

export function AdminDetailsPage({ ctx }: RequestInfo) {
  ctx;
  return (
    <div>
      <h1>Admin Details Page</h1>
      <a href="/admin" id="admin-back-link">
        Back to Admin (soft nav)
      </a>
    </div>
  );
}
