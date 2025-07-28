declare module "virtual:stylesheet-lookup" {
  export function findStylesheetsForEntryPoint(
    moduleId: string,
  ): Promise<Set<string>>;
}
