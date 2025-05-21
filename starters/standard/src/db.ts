import { PrismaClient } from "@prisma/client";
import { PrismaD1 } from "@prisma/adapter-d1";
import { env } from "cloudflare:workers";

export let db: PrismaClient;

export const setupDb = async () => {
  const db = new PrismaClient({
    adapter: new PrismaD1(env.DB),
  });

  // context(justinvdm, 21-05-2025): https://github.com/cloudflare/workers-sdk/pull/8283
  await db.$queryRaw`SELECT 1`;
};
