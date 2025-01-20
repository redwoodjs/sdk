"use server"
import { db } from '../../db'

export type InvoiceItem = {
  description: string,
  price: number,
  quantity: number,
}

export type InvoiceTaxes = {
  description: string,
  amount: number
}




// NOTE (peterp, 2025-01-13): The userID will be optional, since we should have that available "somewhere" in the context.
export async function getInvoice(id: string) {

  const invoice =  await db.invoice.findFirstOrThrow({
    where: {
      id,
      userId: '1',
    }
  })

  return {
    ...invoice,
    items: JSON.parse(invoice.items) as InvoiceItem[],
    taxes: JSON.parse(invoice.taxes) as InvoiceTaxes[]
  }
}
