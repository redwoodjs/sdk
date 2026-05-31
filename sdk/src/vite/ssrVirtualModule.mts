const VITE_ID_PREFIX = "/@id/";

export const VIRTUAL_SSR_PREFIX = "virtual:rwsdk:ssr:";

export function normalizeVirtualSsrModuleId(id: string): string | undefined {
  const normalizedId = id.startsWith(VITE_ID_PREFIX)
    ? id.slice(VITE_ID_PREFIX.length)
    : id;

  return normalizedId.startsWith(VIRTUAL_SSR_PREFIX) ? normalizedId : undefined;
}

export function isVirtualSsrModuleId(id: string): boolean {
  return normalizeVirtualSsrModuleId(id) !== undefined;
}
