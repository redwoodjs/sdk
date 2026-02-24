import { requestInfo } from "rwsdk/worker";
import stylesUrl from "./styles.css?url";
import ogImageUrl from "../assets/og-docs.png?url";

export const Document: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const nonce = requestInfo.rw.nonce;
  const theme = requestInfo.ctx?.theme || "system";
  const url = new URL(requestInfo.request.url);
  const origin = url.origin;
  const canonicalUrl = `${origin}${url.pathname.replace(/\/?$/, "/")}`;

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        {/* Per-page <title> and <meta name="description"> are set in DocPage.tsx
            via React 19's metadata hoisting. The tags below are site-wide fallbacks
            that apply when no page-level override is present (e.g. the home page). */}
        <title>RedwoodSDK Docs — The React Framework for Cloudflare</title>
        <meta
          name="description"
          content="Documentation for RedwoodSDK — the React framework for Cloudflare."
        />
        <link rel="canonical" href={canonicalUrl} />
        <link rel="sitemap" href="/sitemap.xml" />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="modulepreload" href="/src/client.tsx" />
        <link rel="stylesheet" href={stylesUrl} />
        <meta property="og:locale" content="en" />
        <meta property="og:site_name" content="RedwoodSDK" />
        <meta
          property="og:title"
          content="RedwoodSDK Documentation | The React Framework for Cloudflare."
        />
        <meta
          property="og:description"
          content="RedwoodSDK is a React Framework for Cloudflare. It begins as a Vite plugin that unlocks SSR, React Server Components, Server Functions, and realtime features. Its standards-based router, with support for middleware and interrupters, gives you fine-grained control over every request and response."
        />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={`${origin}/`} />
        <meta property="og:image" content={`${origin}${ogImageUrl}`} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="RedwoodSDK Docs" />
        <meta
          name="twitter:description"
          content="Official RedwoodSDK documentation for building full-stack React applications on Cloudflare."
        />
        <meta name="twitter:image" content={`${origin}${ogImageUrl}`} />
        <script
          async
          defer
          src="https://scripts.simpleanalyticscdn.com/latest.js"
        ></script>
        <noscript>
          <img
            src="https://queue.simpleanalyticscdn.com/noscript.gif"
            alt=""
            referrerPolicy="no-referrer-when-downgrade"
          />
        </noscript>
      </head>
      <body className="antialiased">
        <script
          nonce={nonce}
          dangerouslySetInnerHTML={{
            __html: `(function(){var t=${JSON.stringify(theme)};var d=document.documentElement;var s=t==="dark"||(t==="system"&&matchMedia("(prefers-color-scheme:dark)").matches);if(s){d.classList.add("dark")}else{d.classList.remove("dark")}d.setAttribute("data-theme",t)})()`,
          }}
        />
        {children}
        <script>import("/src/client.tsx")</script>
      </body>
    </html>
  );
};
