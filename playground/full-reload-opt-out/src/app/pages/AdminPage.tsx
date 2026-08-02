import type { RequestInfo } from "rwsdk/worker";

export function AdminPage({ ctx }: RequestInfo) {
  ctx;
  return (
    <div>
      <h1>Admin Page</h1>
      <p>The admin section uses a warm amber stylesheet.</p>
      <a href="/" id="home-link" data-reload>
        Go to Home (data-reload)
      </a>
      <a href="/admin/details" id="admin-details-link">
        Go to Admin Details (soft nav)
      </a>
    </div>
  );
}
