import { expect, it, describe, beforeAll } from "vitest";
import { invoke } from "../helpers";

describe("Full RSC Lifecycle (Component + Action + DB)", () => {
  beforeAll(async () => {
    await invoke("initDatabase");
    // Clear items for a clean test
    // Note: We could add a clearItems action if needed
  });

  it("should reflect database changes in the rendered component output", async () => {
    const newItemName = "RSC Test Item " + Date.now();

    // 1. Initial State: Verify item is NOT there
    const initialTree = await invoke<any>("getComponentTree", "ItemManager");
    const initialNames = JSON.stringify(initialTree);
    expect(initialNames).not.toContain(newItemName);

    // 2. Perform Server Action: Add the item
    // We pass the name directly since our updated action handles both
    await invoke("trackAndSaveItem", newItemName);

    // 3. Re-verify State: Verify item IS in the tree now
    const updatedTree = await invoke<any>("getComponentTree", "ItemManager");
    const updatedNames = JSON.stringify(updatedTree);
    
    expect(updatedNames).toContain(newItemName);
    expect(updatedNames).toContain("Item Manager");
    

  });
});
