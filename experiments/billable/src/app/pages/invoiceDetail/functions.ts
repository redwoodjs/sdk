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

  // validate that the user can actually modify this invoice.

  console.log("saving...", invoice);

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
  await db.$transaction([
    db.invoice.update({
      data: {
        title,
        number,
        date,
        supplierName,
        supplierContact,
        customer,
        notesA,
        notesB,
      },
      where: {
        id,
      },
    }),
    db.invoiceItem.updateMany({ data: items }),
    db.invoiceTaxItem.updateMany({ data: taxes })
  ]);
}
