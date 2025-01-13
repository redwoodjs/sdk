import { db } from '../../db'
import { calculateSubtotal, calculateTaxes } from '../shared/invoice'


export async function getInvoiceListSummary(userId: number) {

  const invoices = await db.invoice.findMany({
    select: {
      id: true,
      number: true,
      date: true,
      status: true,
      customer: true,
    },
    where: {
      userId
    }
  })
  return invoices.map((invoice) => {

    const { id, date, number, customer, status} = invoice

    // const subtotal = calculateSubtotal(invoice.items as InvoiceItem[])
    // const taxes = calculateTaxes(subtotal, invoice.taxes as InvoiceTaxItem[])

    return {
      id,
      date,
      number,
      customer: customer.split('\n')[0] || '',
      status,
    }
  })
}

// NOTE (peterp, 2025-01-13): The userID will be optional, since we should have that available "somewhere" in the context.
export async function getInvoice(id: number, userId: number) {

  return await db.invoice.findFirstOrThrow({
    where: {
      id,
      userId
    }
  })
}
