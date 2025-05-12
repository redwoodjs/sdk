export function getSmokeTestFunctionsTemplate(): string {
  return `"use server";

// Module-level variable to track the timestamp set by client actions
let serverStoredTimestamp: number = 23; // Default value

export async function smokeTestAction(
  timestamp?: number,
): Promise<unknown> {
  // If timestamp is provided, update the server-stored timestamp
  if (timestamp) {
    serverStoredTimestamp = timestamp;
  }
  
  await new Promise((resolve) => setTimeout(resolve, 0));
  
  // Return both the input timestamp (for verification) and the stored timestamp
  return { 
    status: "ok", 
    timestamp,
    serverStoredTimestamp
  };
}

// Action called from client to update the server-side timestamp
export async function smokeTestClientToServerAction(
  clientTimestamp: number,
): Promise<unknown> {
  serverStoredTimestamp = clientTimestamp;
  return { status: "ok", clientTimestamp };
}

// Action to retrieve the current server-stored timestamp
export async function getSmokeTestTimestamp(): Promise<unknown> {
  return { 
    status: "ok", 
    timestamp: serverStoredTimestamp
  };
}
`;
}
