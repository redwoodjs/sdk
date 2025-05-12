export function getSmokeTestFunctionsTemplate(): string {
  return `"use server";

// Module-level variable to track the timestamp set by client actions
let serverStoredTimestamp: number = 23; // Default value

export async function smokeTestAction(timestamp: number): Promise<unknown> {
  await new Promise((resolve) => setTimeout(resolve, 0));
  serverStoredTimestamp = timestamp;
  
  return { 
    status: "ok", 
    timestamp,
  };
}

export async function getSmokeTestTimestamp(): Promise<unknown> {
  return { 
    status: "ok", 
    timestamp: serverStoredTimestamp
  };
}
`;
}
