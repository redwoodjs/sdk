/**
 * Temporary paths for the generated vendor barrels in development.
 *
 * In dev, `directiveModulesDevPlugin` generates these paths in a temp directory
 * (outside of node_modules) and provides barrel content to Vite's optimizer
 * in-memory. The lookup plugins read these paths so the lookup map imports the
 * same temp files the optimizer is configured to pre-bundle.
 */

let vendorClientBarrelPath: string | undefined;
let vendorServerBarrelPath: string | undefined;

export const setVendorBarrelPaths = ({
  client,
  server,
}: {
  client: string;
  server: string;
}) => {
  vendorClientBarrelPath = client;
  vendorServerBarrelPath = server;
};

export const getVendorClientBarrelPath = () => vendorClientBarrelPath;
export const getVendorServerBarrelPath = () => vendorServerBarrelPath;
