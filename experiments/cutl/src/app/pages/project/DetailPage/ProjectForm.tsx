"use client";

import { useState, useRef } from "react";
import { type ProjectItem, type getProject } from "./ProjectDetailPage";
import { deleteLogo, saveProject } from "./functions";
import { PrintPdf } from "./PrintToPdf";
import { link } from "../../../shared/links";
import { Button } from "src/components/ui/button";
import { Input } from "src/components/ui/input";
import { Textarea } from "src/components/ui/textarea";
import { RouteContext } from "../../../../lib/router";


function calculateSubtotal(items: ProjectItem[]) {
  let sum = 0;
  for (const item of items) {
    sum += item.quantity * item.price;
  }
  return sum;
}     


export function ProjectForm(props: {
  project: Awaited<ReturnType<typeof getProject>>;
  ctx: RouteContext;
}) {
  const [project, setProject] = useState(props.project);
  const [items, setItems] = useState(props.project.cutlistItems);

  const subtotal = calculateSubtotal(items);

  const pdfContentRef = useRef<HTMLDivElement>(null);

  return (
    <div>
      <div className="flex gap-2 py-4 justify-end">
        <PrintPdf contentRef={pdfContentRef} />
        <Button
          onClick={async () => {
            await saveProject(project.id, project, items, ctx.user.id);
            window.location.href = "/project/list";
          }}
        >
          Save
        </Button>
      </div>
    <div ref={pdfContentRef}>


      <div className="sm:col-span-3">
        <label
          htmlFor="title"
          className="block text-sm font-medium leading-6 text-gray-900"
        >
          Title
        </label>
        <div className="mt-2">
          <Input
            type="text"
            name="title"
            id="title"
            value={project.title}
            onChange={(e) => setProject({ ...project, title: e.target.value })}
          />
        </div>
      </div>

      <div className="sm:col-span-3">
        <label
          htmlFor="date"
          className="block text-sm font-medium leading-6 text-gray-900"
        >
          Width
        </label>
        <div className="mt-2">
          <Input
            type="number"
            name="width"
            id="width"
            value={project.width}
            onChange={(e) =>
              setProject({ ...project, width: Number(e.target.value) })
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
              key={"cutlistItem" + index}
              item={item}
              currency={project.currency}
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
          <button
            type="button"
            className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
            onClick={() => {
              setItems([...items, { description: "", quantity: 1, price: 1 }]);
            }}
          >
            Add Item
          </button>
        </div>
      </div>

      <div className="col-span-full">
        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-9 text-right">Subtotal:</div>
          <div className="col-span-2">
            {project.currency} {subtotal.toFixed(2)}
          </div>
        </div>
        
        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-9 text-right">Total:</div>
          <div className="col-span-2">
            <input
              type="text"
              value={project.currency}
              onChange={(e) =>
                setProject({ ...project, currency: e.target.value })
              }
            />
            {subtotal.toFixed(2)}
          </div>
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
  item: Awaited<ReturnType<typeof getProject>>["cutlistItems"][number];
  currency: Awaited<ReturnType<typeof getProject>>["currency"];
  onChange: (
    item: Awaited<ReturnType<typeof getProject>>["cutlistItems"][number],
  ) => void;
  onDelete: () => void;
}) {
  return (
    <div className="grid grid-cols-12 gap-4">
       <div className="col-span-2">
        <input
          type="number"
          placeholder="Quantity"
          className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
          value={item.quantity}
          onChange={(e) => onChange({ ...item, quantity: Number(e.target.value) })}
        />
      </div>
      <div className="col-span-2">
        <input
          type="number"
          placeholder="Width"
          className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
          value={item.width}
          onChange={(e) =>
            onChange({ ...item, width: Number(e.target.value) })
          }
        />
      </div>
      <div className="col-span-2">
        <input
          type="number"
          placeholder="Length"
          className="block w-full rounded-md border-0 py-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6"
          value={item.length}
          onChange={(e) => onChange({ ...item, length: Number(e.target.value) })}
        />
      </div>
      <div className="col-span-1">
        <button onClick={onDelete}>Delete</button>
      </div>
    </div>
  );
}