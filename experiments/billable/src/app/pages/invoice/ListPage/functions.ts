'use server';


import { db } from "@redwoodjs/reloaded/worker";
import { getContext } from "../../../../worker";


// We need to pass the context to these somehow?
export async function createInvoice({ ctx }: { ctx: Awaited<ReturnType<typeof getContext>> }) {

  const userId = ctx.user.id

  // todo(peterp, 28-01-2025): Implement templates.
  let lastInvoice = await db.invoice.findFirst({
    where: {
      userId,
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
      userId
    }
  })

  return newInvoice
}
