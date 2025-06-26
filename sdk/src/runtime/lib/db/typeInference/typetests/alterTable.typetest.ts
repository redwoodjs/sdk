import type { Database, Migrations } from "../database";
import type { Expect, Equal } from "./testUtils";

(_it = "alterTable") => {
  const migrations = {
    "0": {
      async up(db) {
        return [
          db.schema
            .createTable("users")
            .addColumn("username", "text", (col) => col.notNull().unique())
            .execute(),
        ];
      },
    },
    "1": {
      async up(db) {
        return [
          db.schema
            .alterTable("users")
            .addColumn("displayName", "text")
            .execute(),
        ];
      },
    },
  } satisfies Migrations;

  type Actual = Database<typeof migrations>;

  type Expected = {
    users: {
      username: string;
      displayName: string;
    };
  };

  (_test: Expect<Equal<Actual, Expected>>) => {};
};
