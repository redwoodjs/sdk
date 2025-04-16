export const Document: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => (
  <html lang="en">
    <head>
      <meta charSet="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>@redwoodjs/starter-minimal</title>
    </head>
    <body>
      <div id="root">{children}</div>
      <script src="/src/client.tsx"></script>
    </body>
  </html>
);
