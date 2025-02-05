"use server";

import {
  type Invoice,
} from "@prisma/client";
import { db } from "../../../../db";
import type { InvoiceItem, InvoiceTaxes } from './CutlistDetailPage';

export async function saveInvoice(id: string, invoice: Omit<Invoice, 'items' | 'taxes'>, items: InvoiceItem[], taxes: InvoiceTaxes[], { ctx }) {

  await db.invoice.findFirstOrThrow({
    where: {
      id,
      userId: ctx.user.id
    }
  })

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

export async function deleteLogo(id: string, { ctx }) {

  await db.invoice.findFirstOrThrow({
    where: {
      id,
      userId: ctx.user.id
    }
  })

  await db.invoice.update({
    data: {
      supplierLogo: null,
    },
    where: {
      id
    }
  })
}

