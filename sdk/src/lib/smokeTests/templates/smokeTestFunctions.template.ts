export function getSmokeTestFunctionsTemplate(): string {
  return `"use server";

export async function smokeTestAction(
  timestamp?: number,
): Promise<unknown> {
  await new Promise((resolve) => setTimeout(resolve, 0));
  return { status: "ok", timestamp };
}
`;
}
