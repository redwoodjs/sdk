"use server";

import React from "react";
import { Layout } from "./Layout";
import { getInvoice } from "./services/invoices";
import { calculateSubtotal, calculateTaxes } from "./shared/invoice";

function Summary(props: Awaited<ReturnType<typeof getInvoice>>) {

  // calculate the total
  const subtotal = calculateSubtotal(props.items)
  const taxes = calculateTaxes(subtotal, props.taxes)
  return (
    <div className="space-y-4 bg-red-50">
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-9 text-right">Subtotal:</div>
        <div className="col-span-2">
          {subtotal.toFixed(2)}
        </div>
      </div>
      {props.taxes.map((tax) => (
        <div className="grid grid-cols-12 gap-4" key={`tax-${tax.id}`}>
          <div className="col-span-4 text-right">
            <input type="text" value={tax.description} />

          </div>
          <div className="col-span-1">
            <input type="text" value={tax.amount} />%
          </div>
          <div className="col-span-1">
            {(subtotal * tax.amount).toFixed(2)}
          </div>
          <div className="col-span-1">
            <button>Delete</button>
          </div>
        </div>
      ))}
      <div className="grid grid-cols-12 gap-4 font-bold">
        <div className="col-span-9 text-right">Total:</div>
        <div className="col-span-2">
          {(subtotal + taxes).toFixed(2)}
        </div>
      </div>
    </div>
  );
}

function Item(props: Awaited<ReturnType<typeof getInvoice>>["items"][number]) {
  return (
    <div className="grid grid-cols-12 gap-4" key={"invoice-item-" + props.id}>
      <div className="col-span-6">
        <input
          type="text"
          placeholder="Description"
          className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
          value={props.description}
        />
      </div>
      <div className="col-span-2">
        <input
          type="number"
          placeholder="Quantity"
          className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
          value={props.quantity}
        />
      </div>
      <div className="col-span-2">
        <input
          type="number"
          placeholder="Price"
          className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
          value={props.price}
        />
      </div>
      <div className="col-span-1">
        {Number(props.quantity * props.price).toFixed(2)}
      </div>
      <div className="col-span-1">
        <button>Delete</button>
      </div>
    </div>
  );
}

export default async function InvoiceDetailPage({ id }: { id: number }) {
  id = Number(id);
  const invoice = await getInvoice(id, 1);

  return (
    <Layout>
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="space-y-12">
          <div className="border-b border-gray-900/10 pb-12">
            <h2 className="text-2xl font-semibold leading-7 text-gray-900">
              Invoice Details
            </h2>
            <p className="mt-1 text-sm leading-6 text-gray-600">
              Create or edit an invoice by filling out the information below.
            </p>

            <div className="mt-10 grid grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-6">
              <div className="sm:col-span-3">
                <label
                  htmlFor="invoice-number"
                  className="block text-sm font-medium leading-6 text-gray-900"
                >
                  Invoice Number
                </label>
                <div className="mt-2">
                  <input
                    type="text"
                    name="invoice-number"
                    id="invoice-number"
                    className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
                    value={invoice.number}
                  />
                </div>
              </div>

              <div className="sm:col-span-3">
                <label
                  htmlFor="date"
                  className="block text-sm font-medium leading-6 text-gray-900"
                >
                  Date
                </label>
                <div className="mt-2">
                  <input
                    type="date"
                    name="date"
                    id="date"
                    className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
                    value={invoice.date.toISOString().split("T")[0]}
                  />
                </div>
              </div>

              <div className="col-span-full">
                <label
                  htmlFor="customer"
                  className="block text-sm font-medium leading-6 text-gray-900"
                >
                  Customer
                </label>
                <div className="mt-2">
                  <textarea
                    name="customer"
                    id="customer"
                    className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
                  >
                    {invoice.customer}
                  </textarea>
                </div>
              </div>

              <div className="col-span-full">
                <label
                  htmlFor="client-info"
                  className="block text-sm font-medium leading-6 text-gray-900"
                >
                  Supplier Name
                </label>
                <div className="mt-2">
                  <textarea
                    id="supplierName"
                    name="supplierName"
                    rows={3}
                    className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
                  >
                    {invoice.supplierName}
                  </textarea>
                </div>
              </div>

              <div className="col-span-full">
                <label
                  htmlFor="client-info"
                  className="block text-sm font-medium leading-6 text-gray-900"
                >
                  Supplier Contact
                </label>
                <div className="mt-2">
                  <textarea
                    id="client-info"
                    name="client-info"
                    rows={3}
                    className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
                  >
                    {invoice.supplierContact}
                  </textarea>
                </div>
              </div>

              <div className="col-span-full">
                <label className="block text-sm font-medium leading-6 text-gray-900">
                  Items
                </label>
                <div className="mt-2 space-y-4">
                  {invoice.items.map(Item)}
                  <button
                    type="button"
                    className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                  >
                    Add Item
                  </button>
                </div>
              </div>

              <div className="col-span-full">
              <Summary {...invoice} />
              </div>

              <div className="col-span-full">
                <div className="mt-2">
                  <textarea
                    id="banking-details"
                    name="banking-details"
                    rows={3}
                    className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
                  >
                    {invoice.notesA}
                  </textarea>
                </div>
              </div>
              <div className="col-span-full">
                <div className="mt-2">
                  <textarea
                    id="banking-details"
                    name="banking-details"
                    rows={3}
                    className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
                  >
                    {invoice.notesB}
                  </textarea>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
