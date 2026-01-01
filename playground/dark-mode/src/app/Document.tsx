import React from "react";
import { requestInfo } from "rwsdk/worker";
import stylesUrl from "./styles.css?url";

export const Document: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const theme = requestInfo?.ctx?.theme || "system";

  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Dark Mode Playground</title>
        <link rel="modulepreload" href="/src/client.tsx" />
        <link rel="stylesheet" href={stylesUrl} />
      </head>
      <body>
        {/* Script to set theme class before React hydrates */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                const theme = ${JSON.stringify(theme)};
                const isSystemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                const shouldBeDark = theme === 'dark' || (theme === 'system' && isSystemDark);
                if (shouldBeDark) {
                  document.documentElement.classList.add('dark');
                } else {
                  document.documentElement.classList.remove('dark');
                }
                document.documentElement.setAttribute('data-theme', theme);
              })();
            `,
          }}
        />
        <div id="root">{children}</div>
        <script>import("/src/client.tsx")</script>
      </body>
    </html>
  );
};

