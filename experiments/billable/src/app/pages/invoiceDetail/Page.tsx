import React, { Suspense } from "react";
import { Layout } from "../../Layout";

import { calculateSubtotal, calculateTaxes } from "../../shared/invoice";
import { FetchInvoice } from "./FetchInvoice";
import { InvoiceForm } from "./InvoiceForm";

function Summary(props: Awaited<ReturnType<typeof getInvoice>>) {
  // calculate the total
  const subtotal = calculateSubtotal(props.items);
  const taxes = calculateTaxes(subtotal, props.taxes);
  return (
    <div className="space-y-4 bg-red-50">
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-9 text-right">Subtotal:</div>
        <div className="col-span-2">{subtotal.toFixed(2)}</div>
      </div>
      {props.taxes.map((tax) => (
        <div className="grid grid-cols-12 gap-4" key={`tax-${tax.id}`}>
          <div className="col-span-4 text-right">
            <input type="text" value={tax.description} />
          </div>
          <div className="col-span-1">
            <input type="text" value={tax.amount} />%
          </div>
          <div className="col-span-1">{(subtotal * tax.amount).toFixed(2)}</div>
          <div className="col-span-1">
            <button>Delete</button>
          </div>
        </div>
      ))}
      <div className="grid grid-cols-12 gap-4 font-bold">
        <div className="col-span-9 text-right">Total:</div>
        <div className="col-span-2">{(subtotal + taxes).toFixed(2)}</div>
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

// This component fetch the data from the server and render the page.
// Can it run a  server action to update the invoice?

export default async function InvoiceDetailPage({ id }: { id: number }) {
  id = Number(id);
  // const invoice = await getInvoice(id, 1);

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

            <Suspense fallback={<div>Loading...</div>}>
              <FetchInvoice id={id}>
                {(invoice) => <InvoiceForm invoice={invoice} />}
              </FetchInvoice>
            </Suspense>
          </div>
        </div>
      </div>
    </Layout>
  );
}
