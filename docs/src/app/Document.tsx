import { Provider } from "@/lib/provider";
import { requestInfo } from "rwsdk/worker";
import stylesUrl from "./styles.css?url";

export const Document: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const nonce = requestInfo.rw.nonce;
  const theme = requestInfo.ctx?.theme || "system";

  return (
    <html lang="en" suppressHydrationWarning>
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
