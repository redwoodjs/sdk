import stylesUrl from "./styles.css?url";

export const Document: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => (
  <html lang="en" className="dark">
    <head>
      <meta charSet="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>RedwoodSDK Docs</title>
      <link rel="modulepreload" href="/src/client.tsx" />
      <link rel="stylesheet" href={stylesUrl} />
      <meta
        property="og:title"
        content="RedwoodSDK Documentation | The React Framework for Cloudflare."
      />
      <meta
        property="og:description"
        content="RedwoodSDK is a React Framework for Cloudflare."
      />
      <meta property="og:type" content="website" />
    </head>
    <body className="bg-zinc-950 text-zinc-200 antialiased">
      {children}
      <script>import("/src/client.tsx")</script>
    </body>
  </html>
);
