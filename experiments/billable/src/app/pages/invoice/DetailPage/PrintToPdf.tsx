import { useReactToPrint } from "react-to-print";
import { Button } from "src/components/ui/button";

export function PrintPdf({
  contentRef,
}: {
  contentRef: React.RefObject<HTMLDivElement>;
}) {
  const reactToPrintFn = useReactToPrint({ contentRef });

  return (
    <div>
      <Button variant="secondary" onClick={() => reactToPrintFn()}>
        Print
      </Button>
    </div>
  );
}
