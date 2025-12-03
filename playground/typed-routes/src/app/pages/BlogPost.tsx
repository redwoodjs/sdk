import { link } from "@/app/shared/links";
import { RequestInfo } from "rwsdk/worker";

export function BlogPost({ ctx, request }: RequestInfo) {
  const url = new URL(request.url);
  const pathParts = url.pathname.split("/").filter(Boolean);
  const year = pathParts[1]; // Extract from /blog/:year/:slug
  const slug = pathParts[2];

  // Test linking back to home
  const homeLink = link("/");
  // Test linking to another blog post
  const otherPostLink = link("/blog/:year/:slug", {
    year: "2025",
    slug: "new-post",
  });

  return (
    <div className="page">
      <h1>Blog Post</h1>
      <p>
        Viewing post: <strong>{slug}</strong> from year <strong>{year}</strong>
      </p>

      <nav>
        <a href={homeLink}>Home</a>
        <a href={otherPostLink}>Another Post</a>
      </nav>

      <div className="code">
        <div>
          Current post: {year}/{slug}
        </div>
        <div>Home link: {homeLink}</div>
        <div>Other post link: {otherPostLink}</div>
      </div>
    </div>
  );
}





