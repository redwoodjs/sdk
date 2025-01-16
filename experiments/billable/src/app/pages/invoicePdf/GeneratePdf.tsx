"use client";

import React, { useRef } from "react";
import { useReactToPrint } from "react-to-print";



export default function GeneratePdf() {

  const contentRef = useRef<HTMLDivElement>(null);
  const reactToPrintFn = useReactToPrint({ contentRef });

  return (
    <div>
      <button onClick={() => reactToPrintFn()}>Print</button>
      <div ref={contentRef}>Content to print</div>
    </div>
  );
}
