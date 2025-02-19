"use client";

import { useState, useRef } from "react";
import { type ProjectItem, type getProject } from "./ProjectDetailPage";
import { saveProject } from "./serverFunctions";
import { PrintPdf } from "./PrintToPdf";
import { Button } from "src/components/ui/button";
import { Input } from "src/components/ui/input";
import { DeleteProjectButton } from "./DeleteProjectButton";


export function ProjectForm(props: {
  project: Awaited<ReturnType<typeof getProject>>;
}) {
  const [project, setProject] = useState(props.project);
  const [items, setItems] = useState<ProjectItem[]>(() => {
    const cutlistItems = props.project.cutlistItems;
    if (typeof cutlistItems === 'string') {
      return JSON.parse(cutlistItems);
    }
    return cutlistItems as ProjectItem[] || [];
  });
  const pdfContentRef = useRef<HTMLDivElement>(null);

  return (
    <div>
      <div className="flex gap-2 py-4 justify-end">
        <DeleteProjectButton id={project.id} />
        <Button
          onClick={async () => {
            await saveProject(project.id, project, items, project.userId);
            window.location.href = "/project/list";
          }}
        >
          Save
        </Button>
        <Button
          onClick={async () => {
            await saveProject(project.id, project, items, project.userId);
            window.location.href = `/project/${project.id}/detail`;
          }}
        >
          Save and Calculate
        </Button>
      </div>
      <div ref={pdfContentRef}>

        <div className="flex flex-col gap-4">
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
          <h2 className="text-lg font-medium leading-6 text-gray-900">Material Details</h2>
          <div className="border border-gray-200 p-4 rounded-md">
          

          <div className="grid grid-cols-4 gap-4">
            <div>
              <label
                htmlFor="boardWidth"
                className="block text-sm font-medium leading-6 text-gray-900"
              >
                Width
              </label>
              <div className="mt-2">
                <Input
                  type="number"
                  name="boardWidth"
                  id="boardWidth"
                  value={project.boardWidth}
                  onChange={(e) =>
                    setProject({ ...project, boardWidth: Number(e.target.value) })
                  }
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="boardLength"
                className="block text-sm font-medium leading-6 text-gray-900"
              >
                Length
              </label>
              <div className="mt-2">
                <Input
                  type="number"
                  name="length"
                  id="length"
                  value={project.boardLength}
                  onChange={(e) =>
                    setProject({ ...project, boardLength: Number(e.target.value) })
                  }
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="bladeWidth"
                className="block text-sm font-medium leading-6 text-gray-900"
              >
                Blade Thickness
              </label>
              <div className="mt-2">
                <Input
                  type="number"
                  name="bladeWidth"
                  id="bladeWidth"
                  value={project.bladeWidth}
                  onChange={(e) =>
                    setProject({ ...project, bladeWidth: Number(e.target.value) })
                  }
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="boardPrice"
                className="block text-sm font-medium leading-6 text-gray-900"
              >
                Board Price
              </label>
              <div className="mt-2">
                <Input
                  type="number"
                  name="boardPrice"
                  id="boardPrice"
                  value={project.boardPrice}
                  onChange={(e) =>
                    setProject({ ...project, boardPrice: Number(e.target.value) })
                  }
                />
              </div>
            </div>
          </div>
          </div>



          <h2 className="text-lg font-medium leading-6 text-gray-900">Cutlist</h2>
          <div className="border border-gray-200 p-4 rounded-md">
            <div className="mt-2 space-y-4">
            <div className="grid grid-cols-12 gap-4">
              <div className="col-span-2">
                <label
                  htmlFor="quantity"
                  className="block text-sm font-medium leading-6 text-gray-900"
                >
                  Quantity
                </label>
              </div>
              <div className="col-span-2">
                <label
                  htmlFor="width"
                  className="block text-sm font-medium leading-6 text-gray-900"
                >
                  Width
                  </label>
              </div>
              <div className="col-span-2">
                <label
                  htmlFor="length"
                  className="block text-sm font-medium leading-6 text-gray-900"
                >
                  Length
                </label>
              </div>
              </div>
              {items.length > 0 && items.map((item: ProjectItem, index: number) => (
                <Item
                  key={"cutlistItem" + index}
                  item={item}
                  currency={project.currency}
                  onChange={(newItem) => {
                    const newItems = [...items as ProjectItem[]];
                    newItems[index] = newItem;
                    setItems(newItems);
                  }}
                  onDelete={() => {
                    const newItems = [...items as ProjectItem[]];
                    newItems.splice(index, 1);
                    setItems(newItems);
                  }}
                />
              ))}
              <button
                type="button"
                className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                onClick={() => {
                  setItems([...items as ProjectItem[], { quantity: 1, width: 1, length: 1 }]);
                }}
              >
                Add Item
              </button>
            </div>
          </div>

          {project.total > 0 && (
            <div className="col-span-full">
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
                {project.total.toFixed(2)}
              </div>
            </div>
          </div>
          )}
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
  item: ProjectItem;
  currency: string;
  onChange: (
    item: ProjectItem,
  ) => void;
  onDelete: () => void;
}) {
  return (
    <div className="grid grid-cols-12 gap-4">
      <div className="col-span-2">
        <input
          type="number"
          placeholder="Quantity"
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
          value={item.quantity}
          onChange={(e) => onChange({ ...item, quantity: Number(e.target.value) })}
        />
      </div>
      <div className="col-span-2">  
        <input
          type="number"
          placeholder="Width"
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
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
          className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
          value={item.length}
          onChange={(e) => onChange({ ...item, length: Number(e.target.value) })}
        />
      </div>
      <div className="col-span-1">
        <button onClick={onDelete}>Remove</button>
      </div>
    </div>
  );
}