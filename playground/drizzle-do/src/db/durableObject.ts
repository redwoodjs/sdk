import { DurableObject } from "cloudflare:workers";
import { drizzle, DrizzleSqliteDODatabase } from "drizzle-orm/durable-sqlite";
import { asc, eq, sql } from "drizzle-orm/sql";
import * as schema from "./schema";

export class AppDurableObject extends DurableObject {
  private db: DrizzleSqliteDODatabase<typeof schema>;

  constructor(ctx: DurableObjectState, env: any) {
    super(ctx, env);
    this.db = drizzle(this.ctx.storage, { schema });

    // Ensure the table exists before accepting requests
    this.ctx.blockConcurrencyWhile(async () => {
      await this.db.run(sql`
        CREATE TABLE IF NOT EXISTS todos (
          id TEXT PRIMARY KEY,
          text TEXT NOT NULL,
          completed INTEGER NOT NULL DEFAULT 0,
          createdAt TEXT NOT NULL
        )
      `);
    });
  }

  // RPC methods for the application logic
  // The Drizzle team recommends bundling database interaction within the DO for maximum performance.

  async getTodos() {
    return await this.db
      .select()
      .from(schema.todos)
      .orderBy(asc(schema.todos.createdAt));
  }

  async insertTodo(todo: typeof schema.todos.$inferInsert) {
    await this.db.insert(schema.todos).values(todo);
  }

  async insertTodos(todos: (typeof schema.todos.$inferInsert)[]) {
    await this.db.insert(schema.todos).values(todos);
  }

  async toggleTodo(id: string, completed: boolean) {
    await this.db
      .update(schema.todos)
      .set({ completed })
      .where(eq(schema.todos.id, id));
  }

  async deleteTodos() {
    await this.db.delete(schema.todos);
  }
}
