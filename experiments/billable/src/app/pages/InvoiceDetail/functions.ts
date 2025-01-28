"use server";

import {
  type Invoice,
} from "@prisma/client";
import { db } from "../../../db";
import type { InvoiceItem, InvoiceTaxes } from './FetchInvoice';

export async function saveInvoice(id: string, invoice: Omit<Invoice, 'items' | 'taxes'>, items: InvoiceItem[], taxes: InvoiceTaxes[], x) {

  console.log(x, x)
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

export async function deleteLogo(id: string) {
  await db.invoice.update({
    data: {
      supplierLogo: null,
    },
    where: {
      id
    }
  })
}

