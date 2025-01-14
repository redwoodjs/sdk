"use client";

import { useActionState, useTransition } from "react";
import { createInvoice } from "./pages/invoiceDetail/functions";

export function CreateInvoiceButton() {
  const [isPending, startTransition] = useTransition();


  const onClick = () => {
    startTransition(async () => {
      const newInvoice = await createInvoice();
      // todo(peterp, 2025-01-14): figure out why this isn't returning
      console.log("new invoice", newInvoice);
    });
  };

  return (

      <button
        onClick={onClick}
        className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
        disabled={isPending}
      >
        Create New Invoice
      </button>

  );
}
