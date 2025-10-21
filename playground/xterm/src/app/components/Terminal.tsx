"use client";

import React from "react";
import { ClientOnly } from "rwsdk/client";

declare global {
  interface ImportMetaEnv {
    SSR: boolean;
  }
}

function ClientTerminal() {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const termRef = React.useRef<any>(null);

  const urlSource =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("source")
      : null;

  console.log("### urlSource", urlSource);

  React.useEffect(() => {
    let disposed = false;
    async function setup() {
      const { Terminal } = await import("@xterm/xterm");
      if (disposed) {
        return;
      }
      const term = new Terminal({ fontSize: 14 });
      termRef.current = term;
      term.open(containerRef.current!);
      term.write("$ ");
      term.onData((data) => {
        term.write(data);
      });
    }
    setup();
    return () => {
      disposed = true;
      if (termRef.current) {
        termRef.current.dispose();
        termRef.current = null;
      }
    };
  }, []);

  return (
    <div
      id="xterm-container"
      style={{
        width: "100%",
        height: "240px",
        border: "1px solid #ccc",
      }}
      ref={containerRef}
    />
  );
}

export const Terminal = () => {
  // context(justinvdm, 21 Oct 2025): We need this here so that the bundler tree shakes away the code below.
  // I don't think we can abstract this check away unfortunately, it needs to be in-place.
  if (import.meta.env.SSR) {
    return null;
  }

  return (
    <ClientOnly>
      <ClientTerminal />
    </ClientOnly>
  );
};
