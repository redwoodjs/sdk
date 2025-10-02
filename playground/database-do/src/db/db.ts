import { env } from "cloudflare:workers";
import { InferDatabase, createDb } from "rwsdk/db";

export const db = createDb(env.APP_DURABLE_OBJECT, "todo-database");

export type AppDatabase = InferDatabase<typeof db>;
export type Todo = AppDatabase["todos"];
