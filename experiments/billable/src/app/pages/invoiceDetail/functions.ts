"use server";
import {
  type Invoice,
  type InvoiceItem,
  type InvoiceTaxItem,
} from "@prisma/client";
import { db } from "../../../db";

export async function saveInvoice(
  id: number,
  invoice: Partial<Invoice>,
  items: InvoiceItem[],
  taxes: InvoiceTaxItem[],
) {
  // use zod to validate?
  const {
    title,
    number,
    date,
    supplierName,
    supplierContact,
    customer,
    notesA,
    notesB,
  } = invoice;

  // is this a new invoice?
  let exists = false
  const n = await db.invoice.count({ where: { id }})
  if (n > 0) {
    exists = true
  }

  if (!exists) {
    // get next invoice number
    const numOfInvoices = await db.invoice.count({ where: { userId: 1 }})
    const invoice = await db.invoice.create({
      data: {
        title,
        number: number ?? (numOfInvoices + 1).toString(),
        date,
        supplierName,
        supplierContact,
        customer,
        notesA,
        notesB,
      }
    })

    // create invoices
    // create taxes
  } else {

    const invoice = await db.invoice.update({
      data: {
        title,
        number,
        date,
        supplierName,
        supplierContact,
        customer,
        notesA,
        notesB
      },
      where:
        { id }
      })

    for (const item of items) {
      if (item.id) {
        await db.invoiceItem.update({
          data: item,
          where: {
            id: item.id
          }
        })
      } else {
        await db.invoiceItem.create({
          data: { ...item, invoiceId: invoice.id, id: undefined },
        })
      }
    }
  }
}

export async function deleteInvoiceItem(id: number) {
  // validate that the user can actually do this.
  await db.invoiceItem.delete({ where: { id }})
}
