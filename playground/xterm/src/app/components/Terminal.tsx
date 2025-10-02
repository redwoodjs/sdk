"use client";

import React from "react";

export function Terminal() {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const termRef = React.useRef<any>(null);

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
