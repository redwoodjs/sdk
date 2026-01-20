"use server";
// @ts-ignore
import { env } from "cloudflare:workers";

/**
 * Example server action that interacts with KV
 */
export async function setKVValue(key: string, value: string): Promise<void> {
  const KV = (env as any).KV;
  if (!KV) throw new Error("KV binding not found");
  await KV.put(key, value);
}

export async function getKVValue(key: string): Promise<string | null> {
  const KV = (env as any).KV;
  if (!KV) throw new Error("KV binding not found");
  return await KV.get(key);
}

/**
 * Example server action that interacts with D1
 */
export async function initDatabase(): Promise<void> {
  const DB = (env as any).DB;
  if (!DB) throw new Error("D1 binding not found");
  
  await DB.prepare(`
    CREATE TABLE IF NOT EXISTS items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL
    )
  `).run();
}

export async function addItem(name: string): Promise<number> {
  const DB = (env as any).DB;
  if (!DB) throw new Error("D1 binding not found");
  
  const result = await DB.prepare("INSERT INTO items (name) VALUES (?)")
    .bind(name)
    .run();
    
  return result.meta.last_row_id;
}

export async function getItems(): Promise<any[]> {
  const DB = (env as any).DB;
  if (!DB) throw new Error("D1 binding not found");
  
  const { results } = await DB.prepare("SELECT * FROM items").all();
  return results;
}
