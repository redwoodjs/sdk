import { PrismaClient } from "@prisma/client";
import { PrismaD1 } from "@prisma/adapter-d1";
import { env } from "cloudflare:workers";

export let db: PrismaClient;

// context(justinvdm, 21-05-2025): For prisma-client-js generator or cases where
// there are dynamic import to the prisma wasm modules, we need to make sure we
// are instantiating the prisma client later in the flow when the wasm would
// have been initialized.
export const setupDb = async () => {
  db = new PrismaClient({
    adapter: new PrismaD1(env.DB),
  });

  // context(justinvdm, 21-05-2025): https://github.com/cloudflare/workers-sdk/pull/8283
  await db.$queryRaw`SELECT 1`;
};
