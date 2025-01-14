"use server"
import { db } from '../../db'
import { calculateSubtotal, calculateTaxes } from '../shared/invoice'

export type InvoiceItem = {
  description: string,
  price: number,
  quantity: number,
}

export type InvoiceTaxes = {
  description: string,
  amount: number
}


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
  }) ?? []



  return invoices.map((invoice) => {

    const { id, date, number, customer, status } = invoice

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

  const invoice =  await db.invoice.findFirstOrThrow({
    where: {
      id,
      userId
    }
  })

  return {
    ...invoice,
    items: JSON.parse(invoice.items) as InvoiceItem[],
    taxes: JSON.parse(invoice.taxes) as InvoiceTaxes[]
  }
}
