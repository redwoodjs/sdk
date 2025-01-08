import { db } from '../../db'

export async function getInvoices(userId: number) {

  //
  const invoices = await db.invoice.findMany()

  // todo calculate total

  console.log(invoices)

  return invoices

}
