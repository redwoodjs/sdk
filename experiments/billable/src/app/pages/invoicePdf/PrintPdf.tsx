"use client";

import { Suspense, useRef } from "react";
import { useReactToPrint } from "react-to-print";


export function PrintPdf() {



  const contentRef = useRef<HTMLDivElement>(null);
  const reactToPrintContent = () => {
    return contentRef.current;
  };

  const handlePrint = useReactToPrint({
    documentTitle: "SuperFileName"
  });


  return (
    <div>

      <Suspense fallback={<div>Loading...</div>}>
      <>
        <button

          onClick={() => {

            console.log("clicked");
            handlePrint()
          }}
        >
          Print.
        </button>
        <div ref={contentRef}>Content to print</div>
        </>
      </Suspense>
    </div>
  );
}
