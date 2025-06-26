import type { Database, Migrations } from "../database";
import type { Expect, Equal } from "./testUtils";

(_it = "createTable") => {
  const migrations = {
    "001_init": {
      async up(db) {
        return [
          db.schema
            .createTable("users")
            .addColumn("username", "text", (col) => col.notNull().unique())
            .execute(),
        ];
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
