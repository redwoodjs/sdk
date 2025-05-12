export function getSmokeTestFunctionsTemplate(): string {
  return `"use server";

// Module-level variable to store the timestamp set by client
// Initialize with a fixed value to verify initial server render
let serverTimestamp: number = 23;

// Function to retrieve the current server timestamp
export async function getSmokeTestTimestamp(): Promise<{ timestamp: number, status: string }> {
  return { timestamp: serverTimestamp, status: "ok" };
}

export async function smokeTestAction(timestamp: number): Promise<unknown> {
  await new Promise((resolve) => setTimeout(resolve, 0));
  serverTimestamp = timestamp;
  return { status: "ok", timestamp };
}
`;
}
