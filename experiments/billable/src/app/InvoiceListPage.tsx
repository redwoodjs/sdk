"use server";

import React from "react";
import { Layout } from "./Layout";
import { getInvoiceListSummary } from "./services/invoices";



function InvoiceItem(invoice: Awaited<ReturnType<typeof getInvoiceListSummary>>[number]) {
  return (
    <tr key={invoice.id}>
      <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm text-gray-900 sm:pl-0">
        <a href={`/invoice/${invoice.id}`}>{invoice.date.toString()}</a>
      </td>
      <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
        {invoice.customer}
      </td>
      <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
        {invoice.total}
      </td>
    </tr>
  );
}

export default async function InvoiceListPage() {
  const invoices = await getInvoiceListSummary(1);
  return (
    <Layout>
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="sm:flex sm:items-center">
          <div className="sm:flex-auto">
            <h1 className="text-2xl font-semibold text-gray-900">Invoices</h1>
            <p className="mt-2 text-sm text-gray-700">
              A list of all invoices including their date, customer name and
              amount.
            </p>
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
                      Amount
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {invoices.map(i => <InvoiceItem {...i} />)}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
