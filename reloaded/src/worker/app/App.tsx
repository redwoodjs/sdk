const vitePreamble = `\
  import RefreshRuntime from "/@react-refresh"
  RefreshRuntime.injectIntoGlobalHook(window)
  window.$RefreshReg$ = () => {}
  window.$RefreshSig$ = () => (type) => type
  window.__vite_plugin_react_preamble_installed__ = true
`;

export const App: React.FC<{ children: React.ReactNode, head?: React.ReactNode }> = ({ head, children }) => (
  <html lang="en">
    <head>
      {head}
      {import.meta.env.DEV && !process.env.PREVIEW ? (
        <script
          type="module"
          dangerouslySetInnerHTML={{ __html: vitePreamble }}
        />
      ) : null}
      <script type="module" src="/src/client.tsx"></script>
    </head>
    <body>
      <div id="root">{children}</div>
    </body>
  </html>
);
