import { db } from '../../db'

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

    const { id, date, number, customer, status, items, taxes} = invoice

    let subtotal = 0
    for (const item of items) {
      subtotal = item.price * item.quantity
    }
    let taxTotal = 0
    for (const tax of taxes) {
      taxTotal += subtotal * tax.amount
    }
    const total = subtotal + taxTotal

    return {
      id,
      date,
      number,
      customer,
      status,
      subtotal,
      taxTotal,
      total,
    }
  })
}
