import { DocumentProps } from "@redwoodjs/sdk/router";
import { TurnstileScript } from "@redwoodjs/sdk/turnstile";

export const Document: React.FC<DocumentProps> = ({
  children,
  rw: { nonce },
}) => (
  <html lang="en">
    <head>
      <meta charSet="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>@redwoodjs/starter-standard</title>
      <TurnstileScript />
      <script nonce={nonce}>import("./src/client.tsx")</script>
    </head>
    <body>
      <div id="root">{children}</div>
    </body>
  </html>
);
