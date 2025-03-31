"use server";

import { type Invoice } from "@prisma/client";
import { db } from "src/db";
import type { InvoiceItem, InvoiceTaxes } from "./InvoiceDetailPage";

export async function saveInvoice(
  id: string,
  invoice: Omit<Invoice, "items" | "taxes">,
  items: InvoiceItem[],
  taxes: InvoiceTaxes[],
  { appContext },
) {
  await db.invoice.findFirstOrThrow({
    where: {
      id,
      userId: appContext.user.id,
    },
  });

  const data: Invoice = {
    ...invoice,
    items: JSON.stringify(items),
    taxes: JSON.stringify(taxes),
    labels: JSON.stringify(invoice.labels),
  };

  await db.invoice.upsert({
    create: data,
    update: data,
    where: {
      id,
    },
  });
}

export async function deleteLogo(id: string, { appContext }) {
  await db.invoice.findFirstOrThrow({
    where: {
      id,
      userId: appContext.user.id,
    },
  });

  await db.invoice.update({
    data: {
      supplierLogo: null,
    },
    where: {
      id,
    },
  });
}
