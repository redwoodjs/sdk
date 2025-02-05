"use client";

import { useState, useRef } from "react";
import {
  type InvoiceTaxes,
  type InvoiceItem,
  type getInvoice,
} from "./InvoiceDetailPage";
import { deleteLogo, saveInvoice } from "./functions";
import { PrintPdf } from "./PrintToPdf";
import { link } from "../../../shared/links";
import { Button } from "src/components/ui/button";
import { Input } from "src/components/ui/input";
import { Textarea } from "src/components/ui/textarea";
import { RouteContext } from "../../../../lib/router";
import { PlusIcon, Trash2Icon } from 'lucide-react'

function calculateSubtotal(items: InvoiceItem[]) {
  let sum = 0;
  for (const item of items) {
    sum += item.quantity * item.price;
  }
  return sum;
}

function calculateTaxes(subtotal: number, taxes: InvoiceTaxes[]) {
  let sum = 0;
  for (const tax of taxes) {
    sum += subtotal * tax.amount;
  }
  return sum;
}

export function InvoiceForm(props: {
  invoice: Awaited<ReturnType<typeof getInvoice>>;
  ctx: RouteContext;
}) {
  const [invoice, setInvoice] = useState(props.invoice);
  const [items, setItems] = useState(props.invoice.items);
  const [taxes, setTaxes] = useState(props.invoice.taxes);

  const subtotal = calculateSubtotal(items);
  const taxTotal = calculateTaxes(subtotal, taxes);
  const total = subtotal + taxTotal;

  const pdfContentRef = useRef<HTMLDivElement>(null);

  return (
    <div>
      <div className="flex gap-2 py-4 justify-end">
        <PrintPdf contentRef={pdfContentRef} />
        <Button
          onClick={async () => {
            await saveInvoice(invoice.id, invoice, items, taxes);
            window.location.href = link("/invoice/list");
          }}
        >
          Save
        </Button>
      </div>

      <div ref={pdfContentRef}>
        <div className="grid grid-cols-12 gap-4">
          {/* SupplierName */}
          <div className="col-span-7">
            <SupplierName
              invoice={invoice}
              setInvoice={(newInvoice) => setInvoice(newInvoice)}
            />
          </div>
          {/* SupplierContact */}
          <div className="col-span-5">
            <Textarea
              defaultValue={invoice.supplierContact ?? ""}
              className="text-right"
              onChange={(e) =>
                setInvoice({ ...invoice, supplierContact: e.target.value })
              }
            />
          </div>

          {/* Customer */}
          <div className="col-span-7">
            <Textarea
              placeholder=""
              className=" font text-5xl"
              defaultValue={invoice.customer ?? ""}
              onChange={(e) =>
                setInvoice({ ...invoice, customer: e.target.value })
              }
            />
          </div>
          {/* Invoice Number + Date */}
          <div className="col-span-5">
            <Input
              type="text"
              name="invoice-number"
              id="invoice-number"
              value={invoice.number}
              onChange={(e) =>
                setInvoice({ ...invoice, number: e.target.value })
              }
            />

            <Input
              type="date"
              name="date"
              id="date"
              value={invoice.date.toISOString().split("T")[0]}
              onChange={(e) =>
                setInvoice({ ...invoice, date: new Date(e.target.value) })
              }
            />
          </div>

          {/* Items */}
          <div className="col-span-full text-right py-2">
            {items.map((item, index) => (
              <Item
                key={"invoiceItem" + index}
                item={item}
                currency={invoice.currency}
                onChange={(newItem) => {
                  const newItems = [...items];
                  newItems[index] = newItem;
                  setItems(newItems);
                }}
                onDelete={() => {
                  const newItems = [...items];
                  newItems.splice(index, 1);
                  setItems(newItems);
                }}
              />
            ))}
            <Button
              variant="outline"
              size="icon"
              onClick={() => {
                setItems([
                  ...items,
                  { description: "", quantity: 1, price: 1 },
                ]);
              }}
            >
              <PlusIcon />
            </Button>
          </div>

          {/* Taxes */}
          <div className="col-start-8 col-span-5">

            {/* Subtotal */}
            <div className="grid grid-cols-5 gap-4 py-4">
              <div className="col-span-2 text-right font-semibold">Subtotal:</div>
              <div className="col-span-2 text-right">
                {invoice.currency} {subtotal.toFixed(2)}
              </div>
            </div>

            <Taxes
              subtotal={subtotal}
              taxes={taxes}
              onChange={(tax, index) => {
                const newTaxes = [...taxes];
                newTaxes[index] = tax;
                setTaxes(newTaxes);
              }}
              onDelete={(index) => {
                if (taxes.length === 1) {
                  setTaxes([]);
                  return;
                }
                const newTaxes = [...taxes];
                newTaxes.splice(index, 1);
                setTaxes(newTaxes);
              }}
              onAdd={() => {
                setTaxes([...taxes, { description: "", amount: 0 }]);
              }}
            />
            <div className="grid grid-cols-5 gap-4 py-4">
              <div className="col-span-2 text-right font-semibold">Total:</div>
              <div className="col-span-2 text-right flex items-center justify-end">
                <Input
                  type="text"
                  className="text-right"
                  value={invoice.currency}
                  onChange={(e) =>
                    setInvoice({ ...invoice, currency: e.target.value })
                  }
                />

                  {total.toFixed(2)}

              </div>
            </div>
          </div>

          <div className="col-span-full border-b" />
          {/* NotesA */}
          <div className="col-span-6">
            <Textarea
              defaultValue={invoice.notesA ?? ""}
              onChange={(e) =>
                setInvoice({ ...invoice, notesA: e.target.value })
              }
            />
          </div>

          {/* NotesB */}
          <div className="col-span-6">
            <Textarea
              className="text-right"
              defaultValue={invoice.notesB ?? ""}
              onChange={(e) =>
                setInvoice({ ...invoice, notesB: e.target.value })
              }
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function Item({
  item,
  currency,
  onChange,
  onDelete,
}: {
  item: Awaited<ReturnType<typeof getInvoice>>["items"][number];
  currency: Awaited<ReturnType<typeof getInvoice>>["currency"];
  onChange: (
    item: Awaited<ReturnType<typeof getInvoice>>["items"][number],
  ) => void;
  onDelete: () => void;
}) {
  return (
    <div className="grid grid-cols-12 gap-4 py-2 border">
      <div className="col-span-7">
        <Textarea
          value={item.description}
          onChange={(e) => onChange({ ...item, description: e.target.value })}
        />
      </div>
      <div className="col-span-2">
        <Input
          value={item.quantity}
          onChange={(e) =>
            onChange({ ...item, quantity: Number(e.target.value) })
          }
        />
      </div>
      <div className="col-span-2">
        <Input
          type="number"
          value={item.price}
          onChange={(e) => onChange({ ...item, price: Number(e.target.value) })}
        />
      </div>
      <div className="col-span-1">

        <Button onClick={onDelete} variant="outline" size="icon"><Trash2Icon /></Button>
      </div>
    </div>
  );
}

function Taxes(props: {
  subtotal: number;
  taxes: Awaited<ReturnType<typeof getInvoice>>["taxes"];
  onChange: (
    tax: Awaited<ReturnType<typeof getInvoice>>["taxes"][0],
    index: number,
  ) => void;
  onDelete: (index: number) => void;
  onAdd: () => void;
}) {
  const taxes = calculateTaxes(props.subtotal, props.taxes);

  return (
    <>
      {props.taxes.map((tax, index) => (
        <div className="grid grid-cols-5 gap-4 py-2" key={`tax-${index}`}>
          <div className="col-span-2">
            <Input
              type="text"
              className="text-right font-semibold"
              value={tax.description}
              onChange={(e) =>
                props.onChange({ ...tax, description: e.target.value }, index)
              }
            />
          </div>
          <div className="col-span-2 flex items-center">
            <Input
              type="number"
              className="text-right"
              value={Math.floor(tax.amount * 100)}
              onChange={(e) =>
                props.onChange(
                  { ...tax, amount: Number(e.target.value) / 100 },
                  index,
                )
              }
            />
            %
          </div>
          <div className="col-span-1 text-right">
            <Button onClick={() => props.onDelete(index)} variant="outline" size="icon">
              <Trash2Icon />
            </Button>
          </div>
        </div>
      ))}

      <div className="col-span-5 py-2 text-right">
        <Button onClick={props.onAdd} variant="outline" size="icon">
          <PlusIcon />
        </Button>
      </div>
    </>
  );
}

export function SupplierName({
  invoice,
  setInvoice,
}: {
  invoice: Awaited<ReturnType<typeof getInvoice>>;
  setInvoice: (invoice: Awaited<ReturnType<typeof getInvoice>>) => void;
}) {
  if (invoice.supplierLogo) {
    return (
      <div>
        <img
          src={invoice.supplierLogo}
          alt={invoice.supplierName ?? "Logo"}
          className="max-w-100"
        />
        <button
          onClick={async () => {
            await deleteLogo(invoice.id);
            setInvoice({ ...invoice, supplierLogo: null });
          }}
        >
          Remove Logo
        </button>
      </div>
    );
  } else {
    return (
      <div>
        <Textarea
          value={invoice.supplierName ?? ""}
          placeholder="Michael Scott Paper Company, Inc."
          onChange={(e) =>
            setInvoice({ ...invoice, supplierName: e.target.value })
          }
        />
        <UploadLogo
          invoiceId={invoice.id}
          onSuccess={(supplierLogo) => {
            setInvoice({ ...invoice, supplierLogo });
          }}
        />
      </div>
    );
  }
}

export function UploadLogo({
  invoiceId,
  onSuccess,
}: {
  invoiceId: string;
  onSuccess: (supplierLogo: string) => void;
}) {
  return (
    <div>
      <input
        type="file"
        accept="image/*"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;

          const formData = new FormData();
          formData.append("file", file);

          try {
            const response = await fetch(
              link("/invoice/:id/upload", { id: invoiceId }),
              {
                method: "POST",
                body: formData,
              },
            );

            if (!response.ok) {
              throw new Error("Upload failed");
            }

            // Handle successful upload
            console.log("Upload successful");
            const data = (await response.json()) as { key: string };
            onSuccess(data.key);
          } catch (error) {
            console.error("Error uploading file:", error);
          }
        }}
      />
    </div>
  );
}
