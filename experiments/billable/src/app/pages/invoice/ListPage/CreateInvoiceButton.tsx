"use client";

import { useTransition } from "react";
import { createInvoice } from "./functions";
import { Button } from "src/components/ui/button";

export function CreateInvoiceButton() {
  const [isPending, startTransition] = useTransition();

  const onClick = () => {
    startTransition(async () => {
      const newInvoice = await createInvoice();
      window.location.href = `/invoice/${newInvoice.id}`;
    });
  };

  return (
    <Button onClick={onClick} disabled={isPending}>
      New Invoice
    </Button>
  );
}
