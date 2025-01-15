"use server";
import {
  type Invoice,
} from "@prisma/client";
import { db } from "../../../db";
import { InvoiceItem, InvoiceTaxes } from "../../services/invoices";

export async function saveInvoice(id: string, invoice: Omit<Invoice, 'items' | 'taxes'>, items: InvoiceItem[], taxes: InvoiceTaxes[]) {

  // validate input with zod
  // validate user id.

  const data: Invoice = {
    ...invoice,
    items: JSON.stringify(items),
    taxes: JSON.stringify(taxes),
  }

  await db.invoice.upsert({
    create: data,
    update: data,
    where: {
      id,
    }
  })
}

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
