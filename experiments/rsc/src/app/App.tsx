export const App: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <html lang="en">
    <head>
      <title>RSC FTW</title>
    </head>
    <body>{children}</body>
  </html>
);
