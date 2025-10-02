import { type Migrations } from "rwsdk/db";

export const migrations = {
  "001_initial_schema": {
    async up(db) {
      return [
        await db.schema
          .createTable("todos")
          .addColumn("id", "text", (col) => col.primaryKey())
          .addColumn("text", "text", (col) => col.notNull())
          .addColumn("completed", "integer", (col) =>
            col.notNull().defaultTo(0),
          )
          .addColumn("createdAt", "text", (col) => col.notNull())
          .execute(),
      ];
    },

    async down(db) {
      await db.schema.dropTable("todos").ifExists().execute();
    },
  },
} satisfies Migrations;
