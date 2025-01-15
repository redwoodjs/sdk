"use client";

import { useState } from "react";
import { getInvoice } from "../../services/invoices";
import { calculateSubtotal, calculateTaxes } from "../../shared/invoice";
import { saveInvoice } from "./functions";

export function InvoiceForm(props: {
  invoice: Awaited<ReturnType<typeof getInvoice>>;
}) {

  const [invoice, setInvoice] = useState(props.invoice);
  const [items, setItems] = useState(props.invoice.items);
  const [taxes, setTaxes] = useState(props.invoice.taxes);

  return (
    <div className="mt-10 grid grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-6">
      <div className="col-span-full">
        <button onClick={() => saveInvoice(invoice.id, invoice, items, taxes)}>
          Save
        </button>
      </div>
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
            onChange={(e) => setInvoice({ ...invoice, number: e.target.value })}
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
            onChange={(e) =>
              setInvoice({ ...invoice, date: new Date(e.target.value) })
            }
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
            defaultValue={invoice.customer}
            onChange={(e) =>
              setInvoice({ ...invoice, customer: e.target.value })
            }
          />
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
            defaultValue={invoice.supplierName}
            onChange={(e) =>
              setInvoice({ ...invoice, supplierName: e.target.value })
            }
          />
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
            defaultValue={invoice.supplierContact}
            onChange={(e) =>
              setInvoice({ ...invoice, supplierContact: e.target.value })
            }
          />
        </div>
      </div>

      <div className="col-span-full">
        <label className="block text-sm font-medium leading-6 text-gray-900">
          Items
        </label>
        <div className="mt-2 space-y-4">
          {items.map((item, index) => (
            <Item
              key={"invoiceItem" + index}
              item={item}
              onChange={(newItem) => {
                const newItems = [...items];
                newItems[index] = newItem;
                setItems(newItems);
              }}
              onDelete={() => {
                console.log("delete")
                // todo update total
                const newItems = [...items]
                delete newItems[index]
                setItems(newItems);
              }}
            />
          ))}
          <button
            type="button"
            className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
            onClick={() => {
              setItems([...items, { description: '', quantity: 1, price: 1 }])
            }}
          >
            Add Item
          </button>
        </div>
      </div>

      <div className="col-span-full">
        <Summary items={items} taxes={taxes} onChange={(tax, index) => {
          const newTaxes = [...taxes]
          newTaxes[index] = tax
          setTaxes(newTaxes)

        }} onDelete={(index) => {
          if (taxes.length === 1) {
            setTaxes([])
            return
          }
          const newTaxes = [...taxes]
          delete newTaxes[index]
          setTaxes(newTaxes)

        }} />
      </div>

      <div className="col-span-full">
        <div className="mt-2">
          <textarea
            id="banking-details"
            name="banking-details"
            rows={3}
            className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
            defaultValue={invoice.notesA ?? ""}
            onChange={(e) => setInvoice({ ...invoice, notesA: e.target.value })}
          />
        </div>
      </div>
      <div className="col-span-full">
        <div className="mt-2">
          <textarea
            id="banking-details"
            name="banking-details"
            rows={3}
            className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
            defaultValue={invoice.notesB ?? ""}
            onChange={(e) => setInvoice({ ...invoice, notesB: e.target.value })}
          />
        </div>
      </div>
    </div>
  );
}

function Item({
  item,
  onChange,
  onDelete,
}: {
  item: Awaited<ReturnType<typeof getInvoice>>["items"][number];
  onChange: (
    item: Awaited<ReturnType<typeof getInvoice>>["items"][number],
  ) => void;
  onDelete: () => void;
}) {

  return (
    <div className="grid grid-cols-12 gap-4">
      <div className="col-span-6">
        <input
          type="text"
          placeholder="Description"
          className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
          value={item.description}
          onChange={(e) => onChange({ ...item, description: e.target.value })}
        />
      </div>
      <div className="col-span-2">
        <input
          type="number"
          placeholder="Quantity"
          className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
          value={item.quantity}
          onChange={(e) =>
            onChange({ ...item, quantity: Number(e.target.value) })
          }
        />
      </div>
      <div className="col-span-2">
        <input
          type="number"
          placeholder="Price"
          className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
          value={item.price}
          onChange={(e) => onChange({ ...item, price: Number(e.target.value) })}
        />
      </div>
      <div className="col-span-1">
        {Number(item.quantity * item.price).toFixed(2)}
      </div>
      <div className="col-span-1">
        <button onClick={onDelete}>Delete</button>
      </div>
    </div>
  );
}

// split out the taxes part.

function Summary(props: {
  items: Awaited<ReturnType<typeof getInvoice>>["items"];
  taxes: Awaited<ReturnType<typeof getInvoice>>["taxes"];
  onChange: (tax: Awaited<ReturnType<typeof getInvoice>>["taxes"][0], index:number) => void;
  onDelete: (index:number) => void
}) {
  const subtotal = calculateSubtotal(props.items);
  const taxes = calculateTaxes(subtotal, props.taxes);

  return (
    <div className="space-y-4 bg-red-50">
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-9 text-right">Subtotal:</div>
        <div className="col-span-2">{subtotal.toFixed(2)}</div>
      </div>
      {props.taxes.map((tax, index) => (
        <div className="grid grid-cols-12 gap-4" key={`tax-${index}`}>
          <div className="col-span-4 text-right">
            <input type="text" value={tax.description} onChange={(e) => props.onChange({ ...tax, description: e.target.value }, index)}/>
          </div>
          <div className="col-span-1">
            <input type="number" value={tax.amount} onChange={(e) => props.onChange({ ...tax, amount: Number(e.target.value) }, index)}/>%
          </div>
          <div className="col-span-1">{(subtotal * tax.amount).toFixed(2)}</div>
          <div className="col-span-1">
            <button onClick={() => props.onDelete(index)}>Delete</button>
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
