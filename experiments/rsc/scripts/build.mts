import { build } from 'vite';
import { viteConfigs } from './viteConfigs.mjs';
import { buildVendorBundles } from './buildVendorBundles.mjs';

const main = async () => {
  await buildVendorBundles()
  await build(viteConfigs.workerDeploymentBuild())
}

main()
