import stylesUrl from "./style.css?url";

export const Document: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => (
  <html lang="en">
    <head>
      <meta charSet="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>YT-DOS: Minimalistic YouTube DoS</title>
      <meta
        name="description"
        content="YT-DOS is a minimalistic YouTube search tool to combat social media scrolling."
      />
      <meta
        name="keywords"
        content="YouTube, search, social media, scrolling, minimalistic, DoS"
      />
      <meta name="author" content="RedwoodSDK" />
      <meta name="robots" content="index, follow" />
      <meta name="googlebot" content="index, follow" />
      <meta name="bingbot" content="index, follow" />
      <meta name="alexa" content="index, follow" />
      <meta name="yandex" content="index, follow" />
      <meta name="sogou" content="index, follow" />
      <meta name="baidu" content="index, follow" />
      <meta
        name="google-site-verification"
        content="google-site-verification=google-site-verification"
      />

      <link rel="stylesheet" href={stylesUrl} />
      <script type="module" src="/src/client.tsx"></script>
    </head>
    <body>
      <div id="root">{children}</div>
    </body>
  </html>
);
