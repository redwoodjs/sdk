import { env } from "cloudflare:workers";
import type { AppDurableObject } from "./durableObject";
import * as schema from "./schema";

export type Todo = typeof schema.todos.$inferSelect;
export type NewTodo = typeof schema.todos.$inferInsert;

export function getDb() {
  const durableObjectId = env.APP_DURABLE_OBJECT.idFromName("todo-database");
  return (
    env.APP_DURABLE_OBJECT as DurableObjectNamespace<AppDurableObject>
  ).get(durableObjectId);
}
