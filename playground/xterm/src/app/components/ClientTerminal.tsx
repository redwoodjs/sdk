"use client";

import React from "react";

declare global {
  interface ImportMetaEnv {
    SSR: boolean;
  }
}

export function Terminal() {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const termRef = React.useRef<any>(null);

  // context(justinvdm, 21 Oct 2025): We need this here so that the bundler tree
  // shakes away the code below. I don't think we can abstract this check away
  // unfortunately, it needs to be in-place. We also need the initial hydrated
  // DOM on the client to match the `null` here returned here for SSR, so we
  // defer the actual rendering until after hydration.
  if (import.meta.env.SSR) {
    return null;
  }

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
