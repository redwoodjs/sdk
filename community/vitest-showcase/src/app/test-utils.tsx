"use server";
import { ItemManager } from "./components/ItemManager";
// @ts-ignore
import { env } from "cloudflare:workers";

export async function initDatabase() {
  const DB = (env as any).DB;
  if (!DB) throw new Error("DB binding not found");
  
  await DB.prepare(`CREATE TABLE IF NOT EXISTS items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL
  )`).run();
  
  // Clean up
  await DB.prepare("DELETE FROM items").run();
}

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
