/**
 * Paths for the generated vendor barrels in development.
 *
 * In dev, `directiveModulesDevPlugin` writes vendor barrel content to stable
 * paths in the SDK package (`dist/__intermediate_builds/...`). These paths are
 * shared with the HMR plugin so it can rewrite the files when a sub-scan
 * discovers new directive files mid-session.
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
