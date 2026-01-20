"use server";
import { ItemManager } from "./components/ItemManager";

/**
 * A bridge-only action that returns the React element tree of an RSC.
 * This runs INSIDE the worker environment.
 */
export async function getComponentTree(componentName: string, props: any = {}): Promise<any> {
  switch (componentName) {
    case "ItemManager":
      // Execute the RSC (async function)
      // @ts-ignore
      return await ItemManager(props);
    default:
      throw new Error(`Component ${componentName} not found for tree inspection`);
  }
}
