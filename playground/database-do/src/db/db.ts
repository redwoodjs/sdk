import { type migrations } from "@/db/migrations";
import { env } from "cloudflare:workers";
import { type Database, createDb } from "rwsdk/db";

export type AppDatabase = Database<typeof migrations>;
export type Todo = AppDatabase["todos"];

export const db = createDb<AppDatabase>(
  env.APP_DURABLE_OBJECT,
  "todo-database",
);
