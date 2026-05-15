/**
 * Mock implementation of the virtual:use-client-lookup.js module for tests.
 * This provides an empty lookup object since tests don't need to actually
 * load client modules - they use dependency injection for React hooks.
 */
export const useClientLookup: Record<string, () => Promise<any>> = {};
