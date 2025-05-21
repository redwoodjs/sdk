import { PrismaClient } from "@generated/prisma";
import { PrismaD1 } from "@prisma/adapter-d1";
import { env } from "cloudflare:workers";

export const db = new PrismaClient({
  // context(justinvdm, 21-05-2025): prisma-client generated type appears to
  // consider D1 adapter incompatible, though in runtime (dev and production)
  // it works
  // @ts-ignore
  adapter: new PrismaD1(env.DB),
});
