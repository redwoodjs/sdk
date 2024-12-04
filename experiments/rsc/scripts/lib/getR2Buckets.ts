import { readWranglerConfig } from "./readWranglerConfig.mjs";

export const getR2Buckets = async () => {
  const config = await readWranglerConfig();
  return config.r2_buckets.map((bucket: { binding: string }) => bucket.binding);
};
