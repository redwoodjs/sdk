import type { Database, Migrations } from "../database";
import type { Expect, Equal } from "./testUtils";

(_it = "createTable") => {
  const migrations = {
    "001_init": {
      async up(db) {
        return [
          await db.schema
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

(_it = "createTable with multiple columns and defaults") => {
  const migrations = {
    "001_init": {
      async up(db) {
        return [
          await db.schema
            .createTable("users")
            .addColumn("username", "text", (col) => col.notNull())
            .addColumn("age", "integer", (col) => col.defaultTo(18))
            .addColumn("active", "boolean", (col) => col.defaultTo(true))
            .execute(),
        ];
      },
    },
  } satisfies Migrations;

  type Actual = Database<typeof migrations>;
  type Expected = {
    users: {
      username: string;
      age: number;
      active: boolean;
    };
  };
  (_test: Expect<Equal<Actual, Expected>>) => {};
};
