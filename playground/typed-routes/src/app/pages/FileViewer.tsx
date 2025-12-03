import { link } from "@/app/shared/links";
import { RequestInfo } from "rwsdk/worker";

export function FileViewer({ ctx, request }: RequestInfo) {
  const url = new URL(request.url);
  const filePath = url.pathname.replace("/files/", ""); // Extract from /files/*

  // Test linking back to home
  const homeLink = link("/");
  // Test linking to another file
  const otherFileLink = link("/files/*", { $0: "images/photo.jpg" });

  return (
    <div className="page">
      <h1>File Viewer</h1>
      <p>
        Viewing file: <strong>{filePath}</strong>
      </p>

      <nav>
        <a href={homeLink}>Home</a>
        <a href={otherFileLink}>Another File</a>
      </nav>

      <div className="code">
        <div>Current file: {filePath}</div>
        <div>Home link: {homeLink}</div>
        <div>Other file link: {otherFileLink}</div>
      </div>
    </div>
  );
}






