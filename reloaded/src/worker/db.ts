import { PrismaClient } from '@prisma/client'
import { PrismaD1 } from '@prisma/adapter-d1'

export let db: PrismaClient;

export const createDbClient = (env: Env) =>
  new PrismaClient({ adapter: new PrismaD1(env.DB) });

export const setupDb = (env: Env) => {
  db = createDbClient(env);
};
