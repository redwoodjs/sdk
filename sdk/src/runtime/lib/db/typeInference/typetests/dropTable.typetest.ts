import type { Database, Migrations } from "../database";
import type { Expect, Equal } from "./testUtils";

(_it = "dropTable") => {
  const migrations = {
    "0": {
      async up(db) {
        return [
          db.schema
            .createTable("users")
            .addColumn("username", "text", (col) => col.notNull().unique())
            .execute(),

          db.schema.createTable("posts").addColumn("title", "text").execute(),
        ];
      },
    },
    "1": {
      async up(db) {
        return [db.schema.dropTable("posts").execute()];
      },
    },
  } satisfies Migrations;

  type Actual = Database<typeof migrations>;
  type Expected = {
    users: {
      username: string;
    };
  };

  (_test: Expect<Equal<Actual, Expected>>) => {};
};
