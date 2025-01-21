'use server';

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
      supplierLogo: lastInvoice?.supplierLogo,
      supplierContact: lastInvoice?.supplierContact,
      notesA: lastInvoice?.notesA,
      notesB: lastInvoice?.notesB,
      taxes: lastInvoice?.taxes,
      userId: '1'
    }
  })

  return newInvoice
}
