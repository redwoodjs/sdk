import { type migrations } from "@/db/migrations";
import { env } from "cloudflare:workers";
import { type Database, createDb } from "rwsdk/db";

export type AppDatabase = Database<typeof migrations>;
export type User = AppDatabase["users"];
export type Testimonial = AppDatabase["testimonials"];

export const db = createDb<AppDatabase>(
  env.APP_DURABLE_OBJECT,
  "main-database", // unique key for this database instance
);
