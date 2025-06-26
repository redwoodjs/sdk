import type { Database, Migrations } from "../database";
import type { Expect, Equal } from "./testUtils";

(_it = "addColumn with default value") => {
  const migrations = {
    "0": {
      async up(db) {
        return [
          db.schema
            .createTable("users")
            .addColumn("username", "text", (col) => col.notNull().unique())
            .addColumn("posts", "integer", (col) => col.defaultTo(0).notNull())
            .execute(),
        ];
      },
    },
  } satisfies Migrations;

  type Actual = Database<typeof migrations>;
  type Expected = {
    users: {
      username: string;
      posts: number;
    };
  };

  (_test: Expect<Equal<Actual, Expected>>) => {};
};

// All tests for createTable, dropTable, and alterTable have been moved to their own files.
