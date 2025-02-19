import stylesUrl from "./style.css?url";

export const Document: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <html lang="en">
    <head>
      <meta charSet="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <meta name="description" content="Cutable: Plan. Cut. Optimize." />
      <meta name="keywords" content="Cutable, Plan, Cut, Optimize. Cutlist, Cutable.app" />
      <meta name="author" content="Cutable" />
      <meta name="robots" content="index, follow" />
      <meta name="googlebot" content="index, follow" />
      <meta name="bingbot" content="index, follow" />
      <meta name="alexa" content="index, follow" />
      <meta name="yandex" content="index, follow" />

      <title>Cutable: Plan. Cut. Optimize.</title>
      <link rel="stylesheet" href={stylesUrl} />
      <script type="module" src="/src/client.tsx"></script>
      <script type="text/javascript">{`
          (function(c,l,a,r,i,t,y){
              c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
              t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
              y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
          })(window, document, "clarity", "script", "qc5fhoezed");
      `}</script>
    </head>
    <body>
      <div id="root">{children}</div>
    </body>
  </html>
);
