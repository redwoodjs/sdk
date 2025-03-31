"use server";

import { db } from "src/db";
import { AppContext } from "../../../../worker";

// We need to pass the context to these somehow?
export async function createInvoice({
  appContext,
}: {
  appContext: AppContext;
}) {
  const userId = appContext.user.id;

  // todo(peterp, 28-01-2025): Implement templates.
  let lastInvoice = await db.invoice.findFirst({
    where: {
      userId,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  const newInvoice = await db.invoice.create({
    data: {
      number: (Number(lastInvoice?.number || 0) + 1).toString(),
      supplierName: lastInvoice?.supplierName,
      supplierLogo: lastInvoice?.supplierLogo,
      supplierContact: lastInvoice?.supplierContact,
      notesA: lastInvoice?.notesA,
      notesB: lastInvoice?.notesB,
      taxes: lastInvoice?.taxes,
      userId,
    },
  });

  return newInvoice;
}
