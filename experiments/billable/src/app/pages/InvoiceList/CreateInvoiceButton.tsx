"use client";

import { useTransition } from "react";
import { createInvoice } from "./pages/invoiceDetail/functions";

export function CreateInvoiceButton() {
  const [isPending, startTransition] = useTransition();

  const onClick = () => {
    startTransition(async () => {
      const newInvoice = await createInvoice();
      window.location.href = `/invoice/${newInvoice.id}`;
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
