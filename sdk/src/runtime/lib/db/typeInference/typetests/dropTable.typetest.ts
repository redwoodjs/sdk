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

(_it = "dropTable non-existent table") => {
  const migrations = {
    "0": {
      async up(db) {
        return [db.schema.dropTable("ghost").execute()];
      },
    },
  } satisfies Migrations;
  type Actual = Database<typeof migrations>;
  type Expected = {};
  (_test: Expect<Equal<Actual, Expected>>) => {};
};

(_it = "dropTable all tables") => {
  const migrations = {
    "0": {
      async up(db) {
        return [
          db.schema.createTable("a").addColumn("x", "text").execute(),
          db.schema.createTable("b").addColumn("y", "text").execute(),
        ];
      },
    },
    "1": {
      async up(db) {
        return [
          db.schema.dropTable("a").execute(),
          db.schema.dropTable("b").execute(),
        ];
      },
    },
  } satisfies Migrations;
  type Actual = Database<typeof migrations>;
  type Expected = {};
  (_test: Expect<Equal<Actual, Expected>>) => {};
};

(_it = "chaining createTable and dropTable") => {
  const migrations = {
    "0": {
      async up(db) {
        return [
          db.schema
            .createTable("users")
            .addColumn("username", "text")
            .execute(),
          db.schema.createTable("posts").addColumn("title", "text").execute(),
        ];
      },
    },
    "1": {
      async up(db) {
        return [
          db.schema.dropTable("posts").execute(),
          db.schema.createTable("comments").addColumn("text", "text").execute(),
        ];
      },
    },
  } satisfies Migrations;

  type Actual = Database<typeof migrations>;
  type Expected = {
    users: {
      username: string;
    };
    comments: {
      text: string;
    };
  };

  (_test: Expect<Equal<Actual, Expected>>) => {};
};
