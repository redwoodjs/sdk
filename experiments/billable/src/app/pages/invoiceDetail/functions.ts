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
      date: 'desc',
    }
  })
  if (!lastInvoice) {
    // lastInvoice = {
    //   number: "1",
    //   supplierName: "Your company name",
    //   supplierContact: "Your company details",
    // }
  }


  await db.invoice.create({
    data: {
      // determine next invoice number.

      number: 'todo',
      userId: '1'
    }
  })
}
