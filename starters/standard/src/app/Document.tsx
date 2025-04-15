<<<<<<< Updated upstream
import { TurnstileScript } from "@redwoodjs/sdk/turnstile";

export const Document: React.FC<{ children: React.ReactNode }> = ({
  children,
=======
import { DocumentProps } from "@redwoodjs/sdk/router";

export const Document: React.FC<DocumentProps> = ({
  children,
  rw: { nonce },
>>>>>>> Stashed changes
}) => (
  <html lang="en">
    <head>
      <meta charSet="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>@redwoodjs/starter-standard</title>
<<<<<<< Updated upstream
      <TurnstileScript />
      <script type="module" src="/src/client.tsx"></script>
=======
      <script nonce={nonce}>import("./src/client.tsx")</script>
>>>>>>> Stashed changes
    </head>
    <body>
      <div id="root">{children}</div>
    </body>
  </html>
);
