import { env } from "cloudflare:workers";
import { type Database, createDb } from "rwsdk/db";
import { type migrations } from "@/db/migrations";

export type AppDatabase = Database<typeof migrations>;
export type Todo = AppDatabase["todos"];

export const db = createDb<AppDatabase>(
  env.DATABASE,
  "todo-database", // unique key for this database instance
);