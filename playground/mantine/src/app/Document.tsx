import { ColorSchemeScript } from "@mantine/core";
import mantineStyles from "@mantine/core/styles.css?url";
import { requestInfo } from "rwsdk/worker";

export const Document: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => (
  <html lang="en">
    <head>
      <meta charSet="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>Mantine Playground</title>
      <link rel="modulepreload" href="/src/client.tsx" />
      <link rel="stylesheet" href={mantineStyles} />
      <ColorSchemeScript nonce={requestInfo.rw.nonce} />
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
      <div id="hydrate-root">{children}</div>
      <script>import("/src/client.tsx")</script>
    </body>
  </html>
);
