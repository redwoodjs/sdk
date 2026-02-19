import { Provider } from "@/lib/provider";
import { requestInfo } from "rwsdk/worker";
import stylesUrl from "./styles.css?url";
import ogImageUrl from "../assets/og-docs.png?url";

export const Document: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const nonce = requestInfo.rw.nonce;
  const theme = requestInfo.ctx?.theme || "system";
  const origin = new URL(requestInfo.request.url).origin;

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>RedwoodSDK Docs</title>
        <meta
          name="description"
          content="Documentation for RedwoodSDK — the React framework for Cloudflare."
        />
        <link rel="icon" href="/favicon.svg" />
        <link rel="modulepreload" href="/src/client.tsx" />
        <link rel="stylesheet" href={stylesUrl} />
        <meta
          property="og:title"
          content="RedwoodSDK Documentation | The React Framework for Cloudflare."
        />
        <meta
          property="og:description"
          content="Documentation for RedwoodSDK — the React framework for Cloudflare."
        />
        <meta property="og:type" content="website" />
        <meta property="og:image" content={`${origin}${ogImageUrl}`} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta
          name="twitter:title"
          content="RedwoodSDK Documentation | The React Framework for Cloudflare."
        />
        <meta
          name="twitter:description"
          content="Documentation for RedwoodSDK — the React framework for Cloudflare."
        />
        <meta name="twitter:image" content={`${origin}${ogImageUrl}`} />
      </head>
      <body className="antialiased">
        <script
          nonce={nonce}
          dangerouslySetInnerHTML={{
            __html: `(function(){var t=${JSON.stringify(theme)};var d=document.documentElement;var s=t==="dark"||(t==="system"&&matchMedia("(prefers-color-scheme:dark)").matches);if(s){d.classList.add("dark")}else{d.classList.remove("dark")}d.setAttribute("data-theme",t)})()`,
          }}
        />
        <Provider>{children}</Provider>
        <script>import("/src/client.tsx")</script>
      </body>
    </html>
  );
};
