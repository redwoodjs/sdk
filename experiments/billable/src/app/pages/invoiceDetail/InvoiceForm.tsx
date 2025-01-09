"use client"

import { useState } from "react";
<<<<<<< HEAD
import * as React from'react'
import { getInvoice } from "../../services/invoices";
import { calculateSubtotal, calculateTaxes } from "../../shared/invoice";
import { saveInvoice } from "./functions";
// import { saveInvoice } from "./functions";
=======
import { getInvoice } from "../../services/invoices";
import { calculateSubtotal, calculateTaxes } from "../../shared/invoice";
import { deleteInvoiceItem, saveInvoice } from "./functions";
>>>>>>> 463dc97 (Remove errors.)

export function InvoiceForm(props: {
  invoice: Awaited<ReturnType<typeof getInvoice>>;
}) {
<<<<<<< HEAD

  const [invoice, setInvoice] = useState(props.invoice);
  const [items, setItems] = useState(props.invoice.items);
  const [taxes, setTaxes] = useState(props.invoice.taxes);

  function onChangeItem(item: Awaited<ReturnType<typeof getInvoice>>["items"][number]) {
    const index = items.findIndex((i) => i.id === item.id);
    const newItems = [...items];
    newItems[index] = item;
    setItems(newItems);
  }
=======
  const [invoice, setInvoice] = useState(props.invoice);
  const [items, setItems] = useState(props.invoice.items);
  const [taxes, setTaxes] = useState(props.invoice.taxes);
>>>>>>> 463dc97 (Remove errors.)

  return (
    <div className="mt-10 grid grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-6">
      <div className="col-span-full">
<<<<<<< HEAD
        <button onClick={() => saveInvoice(invoice.id, invoice, items, taxes)}>Save</button>
=======
        <button onClick={() => saveInvoice(invoice.id, invoice, items, taxes)}>
          Save
        </button>
>>>>>>> 463dc97 (Remove errors.)
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
<<<<<<< HEAD
            onChange={(e) => setInvoice({ ...invoice, date: new Date(e.target.value) })}
=======
            onChange={(e) =>
              setInvoice({ ...invoice, date: new Date(e.target.value) })
            }
>>>>>>> 463dc97 (Remove errors.)
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
<<<<<<< HEAD
            onChange={(e) => setInvoice({ ...invoice, customer: e.target.value })}
          />

=======
            onChange={(e) =>
              setInvoice({ ...invoice, customer: e.target.value })
            }
          />
>>>>>>> 463dc97 (Remove errors.)
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
<<<<<<< HEAD
            onChange={(e) => setInvoice({ ...invoice, supplierName: e.target.value })}
          />

=======
            onChange={(e) =>
              setInvoice({ ...invoice, supplierName: e.target.value })
            }
          />
>>>>>>> 463dc97 (Remove errors.)
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
<<<<<<< HEAD
            onChange={(e) => setInvoice({ ...invoice, supplierContact: e.target.value })}
          />

=======
            onChange={(e) =>
              setInvoice({ ...invoice, supplierContact: e.target.value })
            }
          />
>>>>>>> 463dc97 (Remove errors.)
        </div>
      </div>

      <div className="col-span-full">
        <label className="block text-sm font-medium leading-6 text-gray-900">
          Items
        </label>
        <div className="mt-2 space-y-4">
<<<<<<< HEAD
          {items.map((item) => <Item key={'invoiceItem' + item.id} {...item} onChange={onChangeItem} />)}
=======
          {items.map((item, index) => (
            <Item
              key={"invoiceItem" + item.id}
              item={item}
              onChange={(newItem) => {
                const newItems = [...items];
                newItems[index] = newItem;
                setItems(newItems);
              }}
              onDelete={() => {
                deleteInvoiceItem(item.id);
                const newItems = [...items]
                delete newItems[index]
                setItems(newItems);
              }}
            />
          ))}
>>>>>>> 463dc97 (Remove errors.)
          <button
            type="button"
            className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
            onClick={() => setItems([...items, { id: 0, invoiceId: invoice.id, description: '', quantity: 1, price: 1 }])}
          >
            Add Item
          </button>
        </div>
      </div>

      <div className="col-span-full">
        {/* <Summary items={items} taxes={taxes} /> */}
      </div>

      <div className="col-span-full">
        <div className="mt-2">
          <textarea
            id="banking-details"
            name="banking-details"
            rows={3}
            className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
<<<<<<< HEAD
            defaultValue={invoice.notesA ?? ''}
            onChange={(e) => setInvoice({ ...invoice, notesA: e.target.value })}
          />

=======
            defaultValue={invoice.notesA ?? ""}
            onChange={(e) => setInvoice({ ...invoice, notesA: e.target.value })}
          />
>>>>>>> 463dc97 (Remove errors.)
        </div>
      </div>
      <div className="col-span-full">
        <div className="mt-2">
          <textarea
            id="banking-details"
            name="banking-details"
            rows={3}
            className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
<<<<<<< HEAD
            defaultValue={invoice.notesB ?? ''}
            onChange={(e) => setInvoice({ ...invoice, notesB: e.target.value })}
          />


=======
            defaultValue={invoice.notesB ?? ""}
            onChange={(e) => setInvoice({ ...invoice, notesB: e.target.value })}
          />
>>>>>>> 463dc97 (Remove errors.)
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
    <div className="grid grid-cols-12 gap-4" key={"invoice-item-" + item.id}>
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

function Summary(props: {
  items: Awaited<ReturnType<typeof getInvoice>>["items"];
  taxes: Awaited<ReturnType<typeof getInvoice>>["taxes"];
}) {
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
