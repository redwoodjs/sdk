import { db } from '../../db'
import { calculateSubtotal, calculateTaxes } from '../shared/invoice'
import { InvoiceItem, InvoiceTaxItem } from '@prisma/client'

export async function getInvoiceListSummary(userId: number) {

  const invoices = await db.invoice.findMany({
    select: {
      id: true,
      number: true,
      date: true,
      status: true,
      customer: true,
      items: {
        select: {
          price: true,
          quantity: true,
        }
      },
      taxes: {
        select: {
          amount: true,
        }
      }
    },
    where: {
      userId
    }
  })
  return invoices.map((invoice) => {

    const { id, date, number, customer, status} = invoice

    const subtotal = calculateSubtotal(invoice.items as InvoiceItem[])
    const taxes = calculateTaxes(subtotal, invoice.taxes as InvoiceTaxItem[])

    return {
      id,
      date,
      number,
      customer: customer.split('\n')[0] || '',
      status,
      subtotal,
      taxes,
      total: subtotal + taxes,
    }
  })
}

export async function getInvoice(id: number, userId: number) {
  return await db.invoice.findUniqueOrThrow({
    include: {
      items: true,
      taxes: true,
    },
    where: {
      id,
      userId
    }
  })
}
