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
