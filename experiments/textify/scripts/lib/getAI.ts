import { readWranglerConfig } from "./readWranglerConfig.mjs";

export const getAI = async () => {
  const config = await readWranglerConfig();
  return config.AI;
};