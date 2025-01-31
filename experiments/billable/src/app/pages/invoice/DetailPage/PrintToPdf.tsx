import { useReactToPrint } from "react-to-print";

export function PrintPdf({ contentRef }: { contentRef: React.RefObject<HTMLDivElement> }) {
  const reactToPrintFn = useReactToPrint({ contentRef });

  return (
    <div>
        <button
          onClick={() =>reactToPrintFn()}
        >
          Print
        </button>
    </div>
  );
}
