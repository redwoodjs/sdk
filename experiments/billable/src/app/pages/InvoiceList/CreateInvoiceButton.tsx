"use client";

import { useTransition } from "react";
import { db } from "../../../db";


export async function createInvoice() {

  // grab the supplier name
  // and the contact information
  // what if the user doesn't have any invoices?
  // we will eventually include an invoice template... maybe I should just shove that in a seperate function for now?
  let lastInvoice = await db.invoice.findFirst({
    where: {
      userId: '1',
    },
    orderBy: {
      createdAt: 'desc',
    }
  })

  const newInvoice = await db.invoice.create({
    data: {
      number: (Number(lastInvoice?.number || 0) + 1).toString(),
      supplierName: lastInvoice?.supplierName,
      supplierContact: lastInvoice?.supplierContact,
      notesA: lastInvoice?.notesA,
      notesB: lastInvoice?.notesB,
      taxes: lastInvoice?.taxes,
      userId: '1'
    }
  })

  return newInvoice
}


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
