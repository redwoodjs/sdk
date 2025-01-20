"use server";

import { Layout } from "../Layout";

import { CreateInvoiceButton } from "./CreateInvoiceButton";
import { db } from "../../../db";

export type InvoiceItem = {
  description: string,
  price: number,
  quantity: number,
}

export type InvoiceTaxes = {
  description: string,
  amount: number
}


async function getInvoiceListSummary() {

  const invoices = await db.invoice.findMany({
    select: {
      id: true,
      number: true,
      date: true,
      status: true,
      customer: true,
    },
    where: {
      userId: '1',
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
      customer: customer?.split('\n')[0] || '',
      status,
    }
  })
}

export async function createInvoice() {

  // grab the supplier name
  // and the contact information
  // what if the user doesn't have any invoices?
  // we will eventually include an invoice template... maybe I should just shove that in a seperate function for now?
  let lastInvoice = await db.invoice.findFirst({
    where: {
      userId: '1',
    },
    orderBy: {
      createdAt: 'desc',
    }
  })

  const newInvoice = await db.invoice.create({
    data: {
      number: (Number(lastInvoice?.number || 0) + 1).toString(),
      supplierName: lastInvoice?.supplierName,
      supplierContact: lastInvoice?.supplierContact,
      notesA: lastInvoice?.notesA,
      notesB: lastInvoice?.notesB,
      taxes: lastInvoice?.taxes,
      userId: '1'
    }
  })

  return newInvoice
}


export default async function InvoiceListPage() {
  const invoices = await getInvoiceListSummary();
  return (
    <Layout>
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="sm:flex sm:items-center">
          <div className="sm:flex-auto">
            <h1 className="text-2xl font-semibold text-gray-900">Invoices</h1>
          </div>
          <div className="mt-2">
            <CreateInvoiceButton />
          </div>
        </div>
        <div className="mt-8 flow-root">
          <div className="-mx-4 -my-2 overflow-x-auto sm:-mx-6 lg:-mx-8">
            <div className="inline-block min-w-full py-2 align-middle sm:px-6 lg:px-8">
              <table className="min-w-full divide-y divide-gray-300">
                <thead>
                  <tr>
                    <th
                      scope="col"
                      className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-0"
                    >
                      Date
                    </th>
                    <th
                      scope="col"
                      className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900"
                    >
                      Customer
                    </th>

                    <th
                      scope="col"
                      className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900"
                    >
                      Invoice #
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {invoices.map((i) => (
                    <InvoiceListItem {...i} key={"invoice-" + i.id} />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}

// todo: fix the total
// todo: make the entire row clickable
function InvoiceListItem(
  props: Awaited<ReturnType<typeof getInvoiceListSummary>>[number],
) {
  return (
    <tr
      className="cursor-pointer"
    >
      <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm text-gray-900 sm:pl-0">
        <a href={`/invoice/${props.id}`}>{props.date.toLocaleDateString(undefined, {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        })}</a>
      </td>
      <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
        {props.customer}
      </td>
      <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
        {props.number}
      </td>
    </tr>
  );
}
