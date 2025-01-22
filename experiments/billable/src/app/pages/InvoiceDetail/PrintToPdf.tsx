"use client";

import { Suspense, useRef } from "react";
import { useReactToPrint } from "react-to-print";

export function PrintPdf() {
  const contentRef = useRef<HTMLDivElement>(null);
  const reactToPrintFn = useReactToPrint({ contentRef });

  return (
    <div>

      <Suspense fallback={<div>Loading...</div>}>
      <>
        <button

          onClick={() =>reactToPrintFn()}
        >
          Print.
        </button>
        <div ref={contentRef}>Content to print</div>
        </>
      </Suspense>
    </div>
  );
}
