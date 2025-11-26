import { link } from "@/app/shared/links";
import { RequestInfo } from "rwsdk/worker";

export function Home({ ctx }: RequestInfo) {
  // Test static route
  const homeLink = link("/");

  // Test routes with parameters
  const userLink = link("/users/:id", { id: "123" });
  const fileLink = link("/files/*", { $0: "documents/readme.md" });
  const blogLink = link("/blog/:year/:slug", {
    year: "2024",
    slug: "hello-world",
  });

  // TypeScript correctly catches invalid routes:
  // link("/user/"); // Error: Argument of type '"/user/"' is not assignable to parameter of type '"/" | "/users/:id" | "/files/*" | "/blog/:year/:slug"'

  return (
    <div className="page">
      <h1>Typed Routes Playground</h1>
      <p>
        This playground tests typed routes with automatic route inference using{" "}
        <code>defineLinks</code>.
      </p>

      <nav>
        <a href={homeLink}>Home</a>
        <a href={userLink}>User Profile (ID: 123)</a>
        <a href={fileLink}>File Viewer</a>
        <a href={blogLink}>Blog Post</a>
      </nav>

      <div className="code">
        <div>Home: {homeLink}</div>
        <div>User: {userLink}</div>
        <div>File: {fileLink}</div>
        <div>Blog: {blogLink}</div>
      </div>

      <h2>Route Types Tested</h2>
      <ul>
        <li>
          <strong>Static route:</strong> <code>/</code>
        </li>
        <li>
          <strong>Named parameter:</strong> <code>/users/:id</code>
        </li>
        <li>
          <strong>Wildcard:</strong> <code>/files/*</code>
        </li>
        <li>
          <strong>Multiple parameters:</strong> <code>/blog/:year/:slug</code>
        </li>
      </ul>
    </div>
  );
}
