import type { DocumentProps } from "rwsdk/worker";

export const Document: React.FC<DocumentProps> = ({ children }) => (
  <html lang="en">
    <head>
      <meta charSet="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>@redwoodjs/starter-standard</title>
      <link
        rel="icon"
        type="image/svg+xml"
        href="/favicon-dark.svg"
        media="(prefers-color-scheme: dark)"
      />
      <link
        rel="icon"
        type="image/svg+xml"
        href="/favicon-light.svg"
        media="(prefers-color-scheme: light)"
      />
    </head>
    <body>
      <div id="root">{children}</div>
      <script>import("/src/client.tsx")</script>
    </body>
  </html>
);
