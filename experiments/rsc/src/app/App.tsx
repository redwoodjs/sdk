export const App: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <html lang="en">
    <head>
      <title>RSC FTW</title>
      <script type="module" src="/src/client.tsx"></script>
    </head>
    <body>
      <div id="root">{children}</div>
    </body>
  </html>
);
