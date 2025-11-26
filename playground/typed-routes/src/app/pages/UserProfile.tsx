import { link } from "@/app/shared/links";
import { RequestInfo } from "rwsdk/worker";

export function UserProfile({ ctx, request }: RequestInfo) {
  const url = new URL(request.url);
  const userId = url.pathname.split("/")[2]; // Extract from /users/:id

  // Test linking back to home
  const homeLink = link("/");
  // Test linking to another user
  const otherUserLink = link("/users/:id", { id: "456" });

  return (
    <div className="page">
      <h1>User Profile</h1>
      <p>
        Viewing profile for user ID: <strong>{userId}</strong>
      </p>

      <nav>
        <a href={homeLink}>Home</a>
        <a href={otherUserLink}>Another User (ID: 456)</a>
      </nav>

      <div className="code">
        <div>Current user: {userId}</div>
        <div>Home link: {homeLink}</div>
        <div>Other user link: {otherUserLink}</div>
      </div>
    </div>
  );
}


