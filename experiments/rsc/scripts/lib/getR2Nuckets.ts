import { readWranglerConfig } from "./readWranglerConfig";

export const getR2Buckets = async () => {
  const config = await readWranglerConfig();
  return config.r2_buckets.map((bucket: { binding: string; bucket_name: string }) => ({
    [bucket.binding]: bucket.bucket_name,
  }));
};
