export function Document({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Server function form action reproduction</title>
      </head>
      <body>{children}</body>
    </html>
  );
}
