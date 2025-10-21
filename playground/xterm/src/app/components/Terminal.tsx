"use client";

import React from "react";

declare global {
  interface ImportMetaEnv {
    SSR: boolean;
  }
}

export function Terminal() {
  if (import.meta.env.SSR) {
    return null;
  }

  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const termRef = React.useRef<any>(null);
  const urlSource = new URLSearchParams(window.location.search).get("source");
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
