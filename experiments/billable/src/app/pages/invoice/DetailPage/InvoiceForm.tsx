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
import { Input as OGInput } from "src/components/ui/input";
import { Textarea as OGTextarea } from "src/components/ui/textarea";
import { RouteContext } from "../../../../lib/router";
import { PlusIcon, Trash2Icon } from "lucide-react";
import { cn } from "src/components/cn";

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

function Spacer() {
  return <div className="col-span-full h-11" />;
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
            // window.location.href = link("/invoice/list");
          }}
        >
          Save
        </Button>
      </div>

      <div ref={pdfContentRef}>
        <div className="grid grid-cols-12">
          <div className="col-span-full border-b border-t">
            <Input
              type="text"
              value={invoice.title}
              className="tracking-widest text-center uppercase md:text-lg"
              onChange={(e) =>
                setInvoice({ ...invoice, title: e.target.value })
              }
            />
          </div>
          <Spacer />

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

          <Spacer />

          {/* Customer */}
          <div className="col-span-7">
            <Textarea
              placeholder=""
              defaultValue={invoice.customer ?? ""}
              onChange={(e) =>
                setInvoice({ ...invoice, customer: e.target.value })
              }
            />
          </div>
          {/* Invoice Number + Date */}
          <div className="col-span-5">
            <div className="grid grid-cols-5 border">
              <div className="col-span-2 border-r border-b">
                <Input
                  type="text"
                  value={invoice.labels.invoiceNumber}
                  placeholder="Invoice #"
                  className="font-bold"
                  onChange={(e) =>
                    setInvoice({
                      ...invoice,
                      labels: {
                        ...invoice.labels,
                        invoiceNumber: e.target.value,
                      },
                    })
                  }
                />
              </div>
              <div className="col-span-3 border-b">
                <Input
                  type="text"
                  value={invoice.number}
                  onChange={(e) =>
                    setInvoice({ ...invoice, number: e.target.value })
                  }
                />
              </div>
              <div className="col-span-2 border-r">
                <Input
                  type="text"
                  value={invoice.labels.invoiceDate}
                  placeholder="Date"
                  className="font-bold"
                  onChange={(e) =>
                    setInvoice({
                      ...invoice,
                      labels: {
                        ...invoice.labels,
                        invoiceDate: e.target.value,
                      },
                    })
                  }
                />
              </div>
              <div className="col-span-3">
                <Input
                  type="date"
                  value={invoice.date.toISOString().split("T")[0]}
                  onChange={(e) =>
                    setInvoice({ ...invoice, date: new Date(e.target.value) })
                  }
                />
              </div>
            </div>
          </div>

          <Spacer />

          {/* Items */}
          <div className="col-span-full">
            <div className="grid grid-cols-12 border border-b-0">
              <div className="col-span-7 border-r">
                <Input
                  type="text"
                  placeholder="Description"
                  className="font-bold"
                  value={invoice.labels.itemDescription}
                  onChange={(e) =>
                    setInvoice({
                      ...invoice,
                      labels: {
                        ...invoice.labels,
                        itemDescription: e.target.value,
                      },
                    })
                  }
                />
              </div>
              <div className="col-span-2 border-r">
                <Input
                  type="number"
                  placeholder="Quantity"
                  className="font-bold"
                  value={invoice.labels.itemQuantity}
                  onChange={(e) =>
                    setInvoice({
                      ...invoice,
                      labels: {
                        ...invoice.labels,
                        itemQuantity: e.target.value,
                      },
                    })
                  }
                />
              </div>
              <div className="col-span-2 border-r">
                <Input
                  type="number"
                  placeholder="Price"
                  className="font-bold"
                  value={invoice.labels.itemPrice}
                  onChange={(e) => {
                    setInvoice({
                      ...invoice,
                      labels: { ...invoice.labels, itemPrice: e.target.value },
                    });
                  }}
                />
              </div>
            </div>

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
                  const newItems = [...items];
                  newItems.splice(index, 1);
                  setItems(newItems);
                }}
              />
            ))}
            <div className="border text-right">
              <Button
                variant="outline"
                size="icon"
                className="m-1"
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
          </div>

          <Spacer />

          {/* Taxes */}
          <div className="col-start-8 col-span-5">
            {/* Subtotal */}
            <div className="grid grid-cols-5 border border-b-0">
              <div className="col-span-2 border-r flex items-center">
                <Input
                  type="text"
                  placeholder="Subtotal"
                  className="font-bold"
                  value={invoice.labels.subtotal}
                  onChange={(e) =>
                    setInvoice({
                      ...invoice,
                      labels: { ...invoice.labels, subtotal: e.target.value },
                    })
                  }
                />
                <div className="w-full text-right pr-2">{invoice.currency}</div>
              </div>
              <div className="col-span-2 p-2">{subtotal.toFixed(2)}</div>
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

            <div className="grid grid-cols-5 border border-t-0">
              <div className="col-span-2 border-r flex items-center">
                <Input type="text" placeholder="Total" className="font-bold" onChange={(e) =>
                    setInvoice({
                      ...invoice,
                      labels: { ...invoice.labels, total: e.target.value },
                    })
                  }
                />
                <Input
                  type="text"
                  className="text-right"
                  value={invoice.currency}
                  onChange={(e) =>
                    setInvoice({ ...invoice, currency: e.target.value })
                  }
                />
              </div>
              <div className="col-span-1 p-2">{total.toFixed(2)}</div>
            </div>
          </div>

          <Spacer />

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
          <div className="col-start-8 col-span-5">
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
    <div className="grid grid-cols-12 border border-b-0">
      <div className="col-span-7 border-r">
        <Textarea
          value={item.description}
          onChange={(e) => onChange({ ...item, description: e.target.value })}
        />
      </div>
      <div className="col-span-2 border-r">
        <Input
          value={item.quantity}
          onChange={(e) =>
            onChange({ ...item, quantity: Number(e.target.value) })
          }
        />
      </div>
      <div className="col-span-2 border-r">
        <Input
          type="number"
          value={item.price}
          onChange={(e) => onChange({ ...item, price: Number(e.target.value) })}
        />
      </div>
      <div className="col-span-1 flex items-start justify-end">
        <Button
          onClick={onDelete}
          variant="outline"
          size="icon"
          className="m-1"
        >
          <Trash2Icon />
        </Button>
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
  return (
    <>
      {props.taxes.map((tax, index) => (
        <div
          className="grid grid-cols-5 border border-b-0"
          key={`tax-${index}`}
        >
          <div className="col-span-2 border-r flex items-center">
            <Input
              type="text"
              value={tax.description}
              className="font-bold"
              onChange={(e) =>
                props.onChange({ ...tax, description: e.target.value }, index)
              }
            />
            <Input
              type="number"
              className="text-right pr-0"
              value={Math.floor(tax.amount * 100)}
              onChange={(e) =>
                props.onChange(
                  { ...tax, amount: Number(e.target.value) / 100 },
                  index,
                )
              }
            />
            <div className="text-left pr-2">%</div>
          </div>
          <div className="col-span-2 flex items-center"></div>
          <div className="col-span-1 text-right">
            <Button
              onClick={() => props.onDelete(index)}
              variant="outline"
              size="icon"
              className="m-1"
            >
              <Trash2Icon />
            </Button>
          </div>
        </div>
      ))}

      <div className="col-span-5 text-right border">
        <Button
          onClick={props.onAdd}
          variant="outline"
          size="icon"
          className="m-1"
        >
          <PlusIcon />
        </Button>
      </div>
    </>
  );
}

function SupplierName({
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
          className="text-5xl"
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

function UploadLogo({
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

function Input(props: React.ComponentProps<typeof OGInput>) {
  return (
    <OGInput
      {...props}
      className={cn(
        "border-none shadow-none rounded-none p-2",
        props.className,
      )}
    />
  );
}

function Textarea(props: React.ComponentProps<typeof OGTextarea>) {
  return (
    <OGTextarea
      {...props}
      className={cn(
        "border-none shadow-none rounded-none p-2 min-h-[100px] resize-none overflow-hidden",
        props.className,
      )}
      onInput={(e) => {
        const target = e.currentTarget;
        target.style.height = "auto";
        target.style.height = `${target.scrollHeight}px`;
      }}
      ref={(textareaRef) => {
        if (textareaRef) {
          textareaRef.style.height = "auto";
          textareaRef.style.height = `${textareaRef.scrollHeight}px`;
        }
      }}
    />
  );
}
