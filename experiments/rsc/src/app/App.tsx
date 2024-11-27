// context(justinvdm, 27 November 2024): Workaround in order to resolve client entry point until we
// are able to get entry point (e.g. via virtual index.html)
import clientEntryUrl from "../client?worker&url";

export const App: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <html lang="en">
    <head>
      <title>RSC FTW</title>
      <script type="module" src={clientEntryUrl}></script>
    </head>
    <body>{children}</body>
  </html>
);
