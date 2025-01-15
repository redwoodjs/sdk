import { readWranglerConfig } from "./readWranglerConfig.mjs";
import { dotenv } from "./dotenv.mjs";

export const getD1Databases = async () => {
  const config = await readWranglerConfig();

  // todo(justinvdm, 2024-11-21): Support multiple databases
  if (!config.d1_databases) {
    return {};
  }

  const db0 = config.d1_databases[0];

  return {
    [db0.binding]: dotenv.DATABASE_ID ?? db0.database_id,
  };
};
