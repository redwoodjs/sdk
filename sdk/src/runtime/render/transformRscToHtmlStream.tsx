import { createFromReadableStream } from "react-server-dom-vite/client.edge";
import { use } from "react";
import { renderToReadableStream } from "react-dom/server.edge";

export const transformRscToHtmlStream = ({
  stream,
  Parent = ({ children }) => <>{children}</>,
  nonce,
}: {
  stream: ReadableStream;
  Parent: React.ComponentType<{ children: React.ReactNode }>;
  nonce?: string;
}) => {
  const thenable = createFromReadableStream(stream);

  const Component = () => (
    <Parent>{(use(thenable) as { node: React.ReactNode }).node}</Parent>
  );
  const el = <Component />;

  return renderToReadableStream(el, {
    nonce,
  });
};
