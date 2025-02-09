import { PrismaClient } from '@prisma/client'
import { PrismaD1 } from '@prisma/adapter-d1'
import { BaseEnv } from './worker';

export let db: PrismaClient;

export const createDbClient = (env: BaseEnv) =>
  new PrismaClient({ adapter: new PrismaD1(env.DB) });

export const setupDb = (env: BaseEnv) => {
  db = createDbClient(env);
};
