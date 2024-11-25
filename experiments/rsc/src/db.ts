import { PrismaClient } from "@prisma/client";
import { PrismaD1 } from '@prisma/adapter-d1'

export let db: ReturnType<typeof createDbClient>

export const createDbClient = (env: Env) => {
  const adapter = new PrismaD1(env.DB)
  const client = new PrismaClient({ adapter })
  return client
}

export const setupDb = (env: Env) => {
  db = createDbClient(env)
}