"use server";

import { Layout } from "../../Layout";

import { CreateInvoiceButton } from "./CreateInvoiceButton";
import { db } from "../../../../db";
import { RouteContext } from "../../../../router";

export type InvoiceItem = {
  description: string,
  price: number,
  quantity: number,
}

export type InvoiceTaxes = {
  description: string,
  amount: number
}


async function getInvoiceListSummary(userId) {

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
    return {
      id,
      date,
      number,
      customer: customer?.split('\n')[0] || '',
      status,
    }
  })
}

export default async function InvoiceListPage({ ctx }: RouteContext) {
  const invoices = await getInvoiceListSummary(ctx.user.id);
  return (
    <Layout ctx={ctx}>
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
              <div className="table min-w-full">
                {/* Header */}
                <div className="table-header-group border-b border-gray-300">
                  <div className="table-row">
                    <div className="table-cell text-left text-sm font-semibold text-gray-900 py-3.5 pl-4 pr-3 sm:pl-0">
                      Date
                    </div>
                    <div className="table-cell text-left text-sm font-semibold text-gray-900 px-3 py-3.5">
                      Customer
                    </div>
                    <div className="table-cell text-left text-sm font-semibold text-gray-900 px-3 py-3.5">
                      Invoice #
                    </div>
                  </div>
                </div>
                {/* Rows */}
                <div className="table-row-group divide-y divide-gray-200">
                  {invoices.map((i) => (
                    <InvoiceListItem {...i} key={"invoice-" + i.id} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}

function InvoiceListItem(
  props: Awaited<ReturnType<typeof getInvoiceListSummary>>[number],
) {
  return (
    <a href={`/invoice/${props.id}`} className="table-row hover:bg-gray-50 cursor-pointer">
      <div className="table-cell whitespace-nowrap py-4 pl-4 pr-3 text-sm text-gray-900 sm:pl-0">
        {props.date.toLocaleDateString(undefined, {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        })}
      </div>
      <div className="table-cell whitespace-nowrap px-3 py-4 text-sm text-gray-500">
        {props.customer}
      </div>
      <div className="table-cell whitespace-nowrap px-3 py-4 text-sm text-gray-500">
        {props.number}
      </div>
    </a>
  );
}
