"use server";
// @ts-ignore
import { env } from "cloudflare:workers";

/**
 * A more complex server function that coordinates between D1 and KV.
 * It inserts an item into D1 and updates a counter in KV.
 */
export async function trackAndSaveItem(name: string): Promise<{ id: number; totalCount: number }> {
    const DB = (env as any).DB;
    const KV = (env as any).KV;

    if (!DB || !KV) throw new Error("Bindings not found");

    // 1. Save to D1
    const result = await DB.prepare("INSERT INTO items (name) VALUES (?)")
        .bind(name)
        .run();
    const id = result.meta.last_row_id;

    // 2. Update counter in KV
    const currentCountStr = await KV.get("total_items_saved") || "0";
    const newCount = parseInt(currentCountStr) + 1;
    await KV.put("total_items_saved", newCount.toString());

    return { id, totalCount: newCount };
}

export async function getSystemStatus(): Promise<{ dbAlive: boolean; kvAlive: boolean }> {
    const DB = (env as any).DB;
    const KV = (env as any).KV;

    const dbAlive = !!DB;
    const kvAlive = !!KV;

    return { dbAlive, kvAlive };
}
