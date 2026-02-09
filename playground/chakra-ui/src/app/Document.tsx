import stylesUrl from "./styles.css?url";
export const Document: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => (
  <html lang="en">
    <head>
      <meta charSet="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>Chakra UI Playground - RedwoodSDK</title>
      <link rel="modulepreload" href="/src/client.tsx" />
      <link rel="stylesheet" href={stylesUrl} />
      <link
        rel="icon"
        href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>⚫️</text></svg>"
      />
    </head>
    <body>
      <div id="hydrate-root">{children}</div>
      <script>import("/src/client.tsx")</script>
    </body>
  </html>
);
