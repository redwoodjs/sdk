import { Kysely } from 'kysely';
import { D1Dialect } from 'kysely-d1';
import type { DB } from 'kysely-codegen';

export let db: ReturnType<typeof createDbClient>

export const createDbClient = (env: Env) => new Kysely<DB>({ dialect: new D1Dialect({ database: env.DB }) });

export const setupDb = (env: Env) => {
  db = createDbClient(env)
}